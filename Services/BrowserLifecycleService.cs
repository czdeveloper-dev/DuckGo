using System.IO;
using System.Net.Http;
using System.Text.Json;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;
using DuckGo.Pipes;

namespace DuckGo.Services;

public class BrowserLifecycleService : IDisposable
{
    private readonly IProfileRepository _profileRepo;
    private readonly BrowserCatalogService _catalogService;
    private readonly BrowserProvisioningService _provisioningService;
    private readonly ProfileStatusService _statusService;
    private readonly DuckPipeClient _pipeClient;
    private readonly DuckBrowserManager _browserManager;
    private readonly Action<ToastPayload> _onToast;
    private readonly DownloadToastService? _downloadToastService;

    public BrowserLifecycleService(
        IProfileRepository profileRepo,
        BrowserCatalogService catalogService,
        BrowserProvisioningService provisioningService,
        ProfileStatusService statusService,
        DuckPipeClient pipeClient,
        DuckBrowserManager browserManager,
        Action<ToastPayload> onToast,
        DownloadToastService? downloadToastService = null)
    {
        _profileRepo = profileRepo;
        _catalogService = catalogService;
        _provisioningService = provisioningService;
        _statusService = statusService;
        _pipeClient = pipeClient;
        _browserManager = browserManager;
        _onToast = onToast;
        _downloadToastService = downloadToastService;

        _browserManager.BrowserExited += (exitedProfileId, exitCode) =>
        {
            _statusService.UpdateStatus(exitedProfileId, "stopped",
                exitCode == 0 ? "Browser closed" : $"Browser exited with code {exitCode}");
        };
    }

    public async Task<BrowserStartResult> StartBrowserAsync(int profileId)
    {
        var profile = await _profileRepo.GetByIdAsync(profileId);
        if (profile == null)
        {
            var error = $"Profile {profileId} not found";
            _onToast(ToastPayload.Error("Error", error));
            _statusService.UpdateStatus(profileId, "stopped", error);
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        if (_browserManager.GetInstance(profileId) != null)
        {
            var error = $"Profile {profile.Name} is already running";
            _onToast(ToastPayload.Error("Already Running", error));
            _statusService.UpdateStatus(profileId, "stopped", error);
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        var browserType = string.IsNullOrEmpty(profile.BrowserType) ? "Chromium" : profile.BrowserType;
        var browserVersion = profile.BrowserVersion;

        if (string.IsNullOrEmpty(browserVersion))
        {
            var catalog = await _catalogService.GetCatalogAsync();
            var latest = catalog
                .Where(b => b.BrowserType.Equals(browserType, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(b => b.Version)
                .FirstOrDefault();

            if (latest != null)
            {
                browserVersion = latest.Version;
                profile.BrowserVersion = browserVersion;
                await _profileRepo.UpdateAsync(profile);
            }
            else
            {
                browserVersion = "120.0";
            }
        }

        // ── Phase 1: Check if browser is already cached ──
        _statusService.UpdateStatus(profileId, "ready", $"Preparing {browserType} {browserVersion}...");

        var cachedResult = await _provisioningService.EnsureInstalledAsync(profileId, browserType, browserVersion);

        if (cachedResult.Success)
        {
            // Browser already installed — go straight to launch
            return await LaunchBrowserAsync(profile, cachedResult.ExecutablePath!);
        }

        // ── Phase 2: Need to download ──
        // Register this profile in the coordinator.
        // If another profile is already downloading the same browser+version, we join it.
        // If not, we start the session.
        var coordinator = DownloadCoordinator.Instance;
        var key = DownloadCoordinator.MakeKey(browserType, browserVersion);

        var waiter = coordinator.TryJoin(browserType, browserVersion, profileId);
        DownloadSession? session;
        bool isInitiator;

        if (waiter != null)
        {
            // Another profile is already downloading — wait for it
            _statusService.UpdateStatus(profileId, "ready", $"Waiting for {browserType} {browserVersion} download...");
            isInitiator = false;
            session = waiter.Session;

            // Show toast (shared)
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _downloadToastService?.Show(
                    $"Downloading {browserType}",
                    $"{browserVersion} (queued by another profile)",
                    locked: true);
            });
        }
        else
        {
            // No active session — start one
            session = coordinator.StartSession(browserType, browserVersion, profileId);
            isInitiator = true;

            _statusService.UpdateStatus(profileId, "ready", $"Downloading {browserType} {browserVersion}...");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _downloadToastService?.Show(
                    $"Downloading {browserType}",
                    $"{browserVersion}",
                    locked: true);
            });
        }

        // ── If this profile is the initiator, run the actual download ──
        if (isInitiator)
        {
            var provisioningResult = await Task.Run(async () =>
                await _provisioningService.EnsureInstalledForSessionAsync(session, profileId)
            ).ConfigureAwait(false);

            if (!provisioningResult.Success)
            {
                System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                    _downloadToastService?.Fail("Download Failed", provisioningResult.Error ?? "Failed to install browser");
                    _onToast(ToastPayload.Error("Browser Error", provisioningResult.Error ?? "Failed to install browser"));
                });

                // Remove any profiles that were waiting from this session
                foreach (var waitingId in session.GetAllProfileIds().Where(id => id != profileId))
                {
                    coordinator.RemoveWaiter(waitingId);
                    _statusService.UpdateStatus(waitingId, "stopped", provisioningResult.Error ?? "Download failed");
                    System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                        _onToast(ToastPayload.Error("Download Failed",
                            $"Download for profile {waitingId} failed: {provisioningResult.Error}"));
                    });
                }

                return new BrowserStartResult { Success = false, ProfileId = profileId, Error = provisioningResult.Error };
            }
        }
        else
        {
            // Wait for the initiator to finish
            while (true)
            {
                SessionState state;
                lock (session.Lock)
                {
                    state = session.State;
                    if (state == SessionState.Success || state == SessionState.Failed ||
                        state == SessionState.Cancelled)
                        break;
                }
                await Task.Delay(200);
            }

            if (session.State == SessionState.Failed)
            {
                coordinator.RemoveWaiter(waiter.Id);
                _statusService.UpdateStatus(profileId, "stopped", session.ErrorMessage ?? "Download failed");
                System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                    _downloadToastService?.Fail("Download Failed", session.ErrorMessage ?? "Download failed");
                    _onToast(ToastPayload.Error("Download Failed",
                        $"{browserType} {browserVersion}: {session.ErrorMessage ?? "Download failed"}"));
                });
                return new BrowserStartResult { Success = false, ProfileId = profileId, Error = session.ErrorMessage };
            }

            if (session.State == SessionState.Cancelled)
            {
                coordinator.RemoveWaiter(waiter.Id);
                _statusService.UpdateStatus(profileId, "stopped", "Download cancelled");
                return new BrowserStartResult { Success = false, ProfileId = profileId, Error = "Cancelled" };
            }

            coordinator.RemoveWaiter(waiter.Id);
        }

        // ── Phase 3: Launch browser ──
        // All profiles reach here: cached success OR download success OR joined session success
        System.Windows.Application.Current?.Dispatcher.Invoke(() => {
            _downloadToastService?.Hide();
        });

        var exePath = session?.ExecutablePath ?? cachedResult.ExecutablePath;
        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
        {
            var catalog = await _catalogService.GetCatalogAsync();
            var def = catalog.FirstOrDefault(b =>
                b.BrowserType.Equals(browserType, StringComparison.OrdinalIgnoreCase) &&
                b.Version.Equals(browserVersion, StringComparison.OrdinalIgnoreCase));
            var installDir = _catalogService.GetInstallDirectory(browserType, browserVersion);
            exePath = await _catalogService.ResolveExecutablePathAsync(installDir, def);
        }

        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
        {
            var error = $"Executable not found: {browserType} {browserVersion}";
            _statusService.UpdateStatus(profileId, "stopped", error);
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Error("Launch Error", error));
            });
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        return await LaunchBrowserAsync(profile, exePath!);
    }

    private async Task<BrowserStartResult> LaunchBrowserAsync(Profile profile, string executablePath)
    {
        _statusService.UpdateStatus(profile.Id, "ready", "Launching DuckBrowser...");

        var launchResult = await Task.Run(async () =>
            await _browserManager.LaunchAsync(profile, executablePath)
        ).ConfigureAwait(false);

        if (launchResult.Success)
        {
            _statusService.UpdateStatus(profile.Id, "running", $"DuckBrowser running on port {launchResult.CdpPort}");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Success("Browser Started",
                    $"Profile {profile.Name} is running on port {launchResult.CdpPort}"));
            });
            return new BrowserStartResult
            {
                Success = true, ProfileId = profile.Id,
                Status = "running", CdpPort = launchResult.CdpPort
            };
        }
        else
        {
            _statusService.UpdateStatus(profile.Id, "stopped", launchResult.Error ?? "Launch failed");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Error("Launch Error", launchResult.Error ?? "Failed to start browser"));
            });
            return new BrowserStartResult
            {
                Success = false, ProfileId = profile.Id, Error = launchResult.Error
            };
        }
    }

    public async Task<BrowserStopResult> StopBrowserAsync(int profileId)
    {
        var instance = _browserManager.GetInstance(profileId);
        if (instance == null)
            return new BrowserStopResult { Success = true, ProfileId = profileId };

        try
        {
            await _browserManager.StopAsync(profileId);
            _statusService.UpdateStatus(profileId, "stopped", "Browser stopped");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Info("Browser Stopped", $"Profile {profileId} has been stopped"));
            });
            return new BrowserStopResult { Success = true, ProfileId = profileId };
        }
        catch (Exception ex)
        {
            var error = $"Failed to stop browser: {ex.Message}";
            _statusService.UpdateStatus(profileId, "stopped", error);
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Error("Stop Error", error));
            });
            return new BrowserStopResult { Success = false, ProfileId = profileId, Error = error };
        }
    }

    public bool IsRunning(int profileId) => _browserManager.GetInstance(profileId) != null;

    public (int? CdpPort, bool IsRunning) GetBrowserInfo(int profileId)
    {
        var instance = _browserManager.GetInstance(profileId);
        if (instance != null) return (instance.CdpPort, true);
        return (null, false);
    }

    public void Dispose()
    {
        _browserManager?.Dispose();
    }
}
