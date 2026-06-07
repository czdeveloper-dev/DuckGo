using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;
using DuckGo.Pipes;

namespace DuckGo.Services;

public class BrowserLifecycleService
{
    private readonly IProfileRepository _profileRepo;
    private readonly BrowserCatalogService _catalogService;
    private readonly BrowserProvisioningService _provisioningService;
    private readonly ProfileStatusService _statusService;
    private readonly DuckPipeClient _pipeClient;
    private readonly Action<ToastPayload> _onToast;
    private readonly Action<ProfileMessageUpdate> _onMessageUpdate;
    private readonly int _startPort;

    private readonly Dictionary<int, (Process Process, int CdpPort)> _runningBrowsers = new();
    private int _nextPort = 9200;

    public BrowserLifecycleService(
        IProfileRepository profileRepo,
        BrowserCatalogService catalogService,
        BrowserProvisioningService provisioningService,
        ProfileStatusService statusService,
        DuckPipeClient pipeClient,
        Action<ToastPayload> onToast,
        Action<ProfileMessageUpdate> onMessageUpdate,
        int startPort = 9200)
    {
        _profileRepo = profileRepo;
        _catalogService = catalogService;
        _provisioningService = provisioningService;
        _statusService = statusService;
        _pipeClient = pipeClient;
        _onToast = onToast;
        _onMessageUpdate = onMessageUpdate;
        _startPort = startPort;
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

        if (_runningBrowsers.ContainsKey(profileId))
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

        await _statusService.UpdateStatusAsync(profileId, "provisioning", $"Checking {browserType} {browserVersion}...");

        var provisioningResult = await _provisioningService.EnsureInstalledAsync(profileId, browserType, browserVersion);
        if (!provisioningResult.Success)
        {
            await _statusService.UpdateStatusAsync(profileId, "error", provisioningResult.Error ?? "Failed to install browser");
            _onToast(ToastPayload.Error("Browser Error", provisioningResult.Error ?? "Failed to install browser"));
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = provisioningResult.Error };
        }

        await _statusService.UpdateStatusAsync(profileId, "starting", "Launching browser...");

        var cdpPort = GetNextPort();
        var profileDir = Path.Combine(AppConfig.ProfilesDir, profileId.ToString());
        Directory.CreateDirectory(profileDir);

        var args = $"--remote-debugging-port={cdpPort} " +
                   $"--profile-directory=\"{profileDir}\" " +
                   $"--user-data-dir=\"{profileDir}\" " +
                   $"--no-first-run " +
                   $"--no-default-browser-check";

        Process? proc;
        try
        {
            proc = Process.Start(new ProcessStartInfo
            {
                FileName = provisioningResult.ExecutablePath,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(provisioningResult.ExecutablePath)
            });
        }
        catch (Exception ex)
        {
            var error = $"Failed to start browser: {ex.Message}";
            await _statusService.UpdateStatusAsync(profileId, "error", error);
            _onToast(ToastPayload.Error("Launch Error", error));
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        if (proc == null)
        {
            var error = "Failed to start browser process";
            await _statusService.UpdateStatusAsync(profileId, "error", error);
            _onToast(ToastPayload.Error("Launch Error", error));
            return new BrowserStartResult { Success = false, ProfileId = profileId, Error = error };
        }

        _runningBrowsers[profileId] = (proc, cdpPort);
        proc.Exited += (_, _) =>
        {
            _runningBrowsers.Remove(profileId);
            _ = _statusService.UpdateStatusAsync(profileId, "stopped", "Browser closed");
        };

        await Task.Delay(2000);

        await _statusService.UpdateStatusAsync(profileId, "running", "Connected to browser");
        _onToast(ToastPayload.Success("Browser Started", $"Profile {profile.Name} is running on port {cdpPort}"));

        return new BrowserStartResult
        {
            Success = true,
            ProfileId = profileId,
            Status = "running",
            CdpPort = cdpPort
        };
    }

    public async Task<BrowserStopResult> StopBrowserAsync(int profileId)
    {
        if (!_runningBrowsers.TryGetValue(profileId, out var browserInfo))
        {
            return new BrowserStopResult { Success = true, ProfileId = profileId };
        }

        try
        {
            browserInfo.Process.Kill();
            await Task.Delay(500);
            _runningBrowsers.Remove(profileId);
            await _statusService.UpdateStatusAsync(profileId, "stopped", "Browser stopped");
            _onToast(ToastPayload.Info("Browser Stopped", $"Profile {profileId} has been stopped"));
            return new BrowserStopResult { Success = true, ProfileId = profileId };
        }
        catch (Exception ex)
        {
            var error = $"Failed to stop browser: {ex.Message}";
            await _statusService.UpdateStatusAsync(profileId, "error", error);
            _onToast(ToastPayload.Error("Stop Error", error));
            return new BrowserStopResult { Success = false, ProfileId = profileId, Error = error };
        }
    }

    public bool IsRunning(int profileId) => _runningBrowsers.ContainsKey(profileId);

    public (int? CdpPort, bool IsRunning) GetBrowserInfo(int profileId)
    {
        if (_runningBrowsers.TryGetValue(profileId, out var info))
            return (info.CdpPort, true);
        return (null, false);
    }

    private int GetNextPort()
    {
        var port = _nextPort++;
        while (IsPortInUse(port)) port = _nextPort++;
        return port;
    }

    private static bool IsPortInUse(int port)
    {
        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            client.Connect("127.0.0.1", port);
            return true;
        }
        catch { return false; }
    }
}
