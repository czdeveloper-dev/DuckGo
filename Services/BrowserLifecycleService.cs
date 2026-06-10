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

    public BrowserLifecycleService(
        IProfileRepository profileRepo,
        BrowserCatalogService catalogService,
        BrowserProvisioningService provisioningService,
        ProfileStatusService statusService,
        DuckPipeClient pipeClient,
        DuckBrowserManager browserManager,
        Action<ToastPayload> onToast)
    {
        _profileRepo = profileRepo;
        _catalogService = catalogService;
        _provisioningService = provisioningService;
        _statusService = statusService;
        _pipeClient = pipeClient;
        _browserManager = browserManager;
        _onToast = onToast;
    }

    public async Task<BrowserStartResult> StartBrowserAsync(int profileId)
    {
        var profile = await _profileRepo.GetByIdAsync(profileId);
        if (profile == null)
        {
            var error = $"Profile {profileId} not found";
            _onToast(ToastPayload.Error("Error", error));
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        if (_browserManager.GetInstance(profileId) != null)
        {
            var error = $"Profile {profileId} is already running";
            _onToast(ToastPayload.Error("Already Running", error));
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

        _statusService.UpdateStatus(profileId, "provisioning", $"Checking {browserType} {browserVersion}...");

        // Run provisioning on background thread
        var provisioningResult = await Task.Run(async () =>
            await _provisioningService.EnsureInstalledAsync(profileId, browserType, browserVersion)
        ).ConfigureAwait(false);

        if (!provisioningResult.Success)
        {
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Error("Browser Error", provisioningResult.Error ?? "Failed to install browser"));
            });
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = provisioningResult.Error };
        }

        _statusService.UpdateStatus(profileId, "starting", "Launching DuckBrowser...");

        // Launch via DuckBrowserManager (handles pipe + CDP)
        var launchResult = await Task.Run(async () =>
            await _browserManager.LaunchAsync(profile)
        ).ConfigureAwait(false);

        if (launchResult.Success)
        {
            _statusService.UpdateStatus(profileId, "running", $"DuckBrowser running on port {launchResult.CdpPort}");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Success("Browser Started", $"Profile {profile.Name} is running on port {launchResult.CdpPort}"));
            });
            return new BrowserStartResult
            {
                Success = true,
                ProfileId = profileId,
                Status = "running",
                CdpPort = launchResult.CdpPort
            };
        }
        else
        {
            _statusService.UpdateStatus(profileId, "error", launchResult.Error ?? "Launch failed");
            System.Windows.Application.Current?.Dispatcher.Invoke(() => {
                _onToast(ToastPayload.Error("Launch Error", launchResult.Error ?? "Failed to start browser"));
            });
            return new BrowserStartResult
            {
                Success = false,
                ProfileId = profileId,
                Error = launchResult.Error
            };
        }
    }

    public async Task<BrowserStopResult> StopBrowserAsync(int profileId)
    {
        var instance = _browserManager.GetInstance(profileId);
        if (instance == null)
        {
            return new BrowserStopResult { Success = true, ProfileId = profileId };
        }

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
            _statusService.UpdateStatus(profileId, "error", error);
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
        if (instance != null)
            return (instance.CdpPort, true);
        return (null, false);
    }

    public void Dispose()
    {
        _browserManager?.Dispose();
    }
}
