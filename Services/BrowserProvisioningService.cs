using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class BrowserProvisioningService
{
    private readonly BrowserCatalogService _catalogService;
    private readonly IInstalledBrowserRepository _installedRepo;
    private readonly Action<ToastPayload> _onToast;
    private readonly Action<ProfileMessageUpdate> _onMessageUpdate;
    private readonly Action<int, string> _onProfileMessage;

    public BrowserProvisioningService(
        BrowserCatalogService catalogService,
        IInstalledBrowserRepository installedRepo,
        Action<ToastPayload> onToast,
        Action<ProfileMessageUpdate> onMessageUpdate,
        Action<int, string> onProfileMessage)
    {
        _catalogService = catalogService;
        _installedRepo = installedRepo;
        _onToast = onToast;
        _onMessageUpdate = onMessageUpdate;
        _onProfileMessage = onProfileMessage;
    }

    public async Task<BrowserProvisioningResult> EnsureInstalledAsync(int profileId, string browserType, string browserVersion)
    {
        var installed = await _installedRepo.GetByTypeAndVersionAsync(browserType, browserVersion);
        if (installed != null && File.Exists(installed.ExecutablePath))
        {
            var isValid = _catalogService.ValidateExecutable(installed.ExecutablePath, browserType, browserVersion);
            if (isValid)
            {
                await NotifyMessageAsync(profileId, $"Browser {browserType} {browserVersion} ready");
                return new BrowserProvisioningResult
                {
                    Success = true,
                    ExecutablePath = installed.ExecutablePath,
                    InstallPath = installed.InstallPath
                };
            }
        }

        return await DownloadAndInstallAsync(profileId, browserType, browserVersion);
    }

    private async Task<BrowserProvisioningResult> DownloadAndInstallAsync(int profileId, string browserType, string browserVersion)
    {
        var toastId = $"browser-install-{profileId}";
        var definition = await _catalogService.GetDefinitionAsync(browserType, browserVersion);

        if (definition == null)
        {
            var error = $"Browser {browserType} {browserVersion} not found in catalog";
            await NotifyMessageAsync(profileId, error);
            _onToast(ToastPayload.Failed(toastId, "Browser Not Found", error));
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        if (string.IsNullOrEmpty(definition.DownloadUrl))
        {
            var error = $"No download URL for {browserType} {browserVersion}";
            await NotifyMessageAsync(profileId, error);
            _onToast(ToastPayload.Failed(toastId, "Download Unavailable", error));
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        var installDir = _catalogService.GetInstallDirectory(browserType, browserVersion);
        Directory.CreateDirectory(installDir);

        await NotifyMessageAsync(profileId, $"Downloading {browserType} {browserVersion}...");
        _onToast(ToastPayload.Progress(toastId, "Downloading Browser",
            $"{browserType} {browserVersion}", 0, "downloading"));

        try
        {
            var zipPath = await DownloadFileAsync(profileId, definition, toastId);
            if (zipPath == null)
            {
                var error = "Download failed";
                await NotifyMessageAsync(profileId, error);
                _onToast(ToastPayload.Failed(toastId, "Download Failed", error));
                return new BrowserProvisioningResult { Success = false, Error = error };
            }

            await NotifyMessageAsync(profileId, $"Installing {browserType} {browserVersion}...");
            _onToast(ToastPayload.Progress(toastId, "Installing Browser",
                $"Extracting {browserType} {browserVersion}", 50, "installing"));

            await ExtractArchiveAsync(zipPath, installDir, profileId, definition);
            File.Delete(zipPath);

            var exePath = await _catalogService.ResolveExecutablePathAsync(installDir, definition);
            if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
            {
                var error = "Browser executable not found after installation";
                await NotifyMessageAsync(profileId, error);
                _onToast(ToastPayload.Failed(toastId, "Install Failed", error));
                return new BrowserProvisioningResult { Success = false, Error = error };
            }

            var installedBrowser = new InstalledBrowser
            {
                BrowserType = browserType,
                BrowserVersion = browserVersion,
                InstallPath = installDir,
                ExecutablePath = exePath,
                InstalledAt = DateTime.UtcNow
            };
            await _installedRepo.UpsertAsync(installedBrowser);

            await NotifyMessageAsync(profileId, $"Browser {browserType} {browserVersion} installed");
            _onToast(ToastPayload.Complete(toastId, "Download Complete",
                $"{browserType} {browserVersion} is ready"));

            return new BrowserProvisioningResult
            {
                Success = true,
                ExecutablePath = exePath,
                InstallPath = installDir
            };
        }
        catch (Exception ex)
        {
            var error = $"Installation failed: {ex.Message}";
            await NotifyMessageAsync(profileId, error);
            _onToast(ToastPayload.Failed(toastId, "Installation Failed", error));
            return new BrowserProvisioningResult { Success = false, Error = error };
        }
    }

    private async Task<string?> DownloadFileAsync(int profileId, BrowserCatalog definition, string toastId)
    {
        try
        {
            using var httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(30) };
            using var response = await httpClient.GetAsync(definition.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? -1L;
            var fileName = $"browser_{definition.BrowserType}_{definition.Version}.zip";
            var tempPath = Path.Combine(AppConfig.UpdatesDir, fileName);
            Directory.CreateDirectory(AppConfig.UpdatesDir);

            await using var contentStream = await response.Content.ReadAsStreamAsync();
            await using var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
            var buffer = new byte[8192];
            long totalRead = 0;
            int bytesRead;

            while ((bytesRead = await contentStream.ReadAsync(buffer)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead));
                totalRead += bytesRead;

                if (totalBytes > 0)
                {
                    var progress = (int)(totalRead * 100 / totalBytes);
                    await NotifyMessageAsync(profileId, $"Downloading {definition.BrowserType} {definition.Version}... {progress}%");
                    _onToast(ToastPayload.Progress(toastId, "Downloading Browser",
                        $"{definition.BrowserType} {definition.Version}", progress, "downloading"));
                }
            }

            return tempPath;
        }
        catch (Exception ex)
        {
            Log("DOWNLOAD_FAIL", $"Error: {ex.Message}");
            return null;
        }
    }

    private async Task ExtractArchiveAsync(string zipPath, string installDir, int profileId, BrowserCatalog definition)
    {
        var toastId = $"browser-install-{profileId}";

        try
        {
            if (File.Exists(zipPath))
                ZipFile.ExtractToDirectory(zipPath, installDir, true);
        }
        catch (InvalidDataException)
        {
            var tempDir = Path.Combine(AppConfig.UpdatesDir, "temp_extract");
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
            Directory.CreateDirectory(tempDir);
            ZipFile.ExtractToDirectory(zipPath, tempDir, true);

            var entries = Directory.GetFileSystemEntries(tempDir);
            foreach (var entry in entries)
            {
                var dest = Path.Combine(installDir, Path.GetFileName(entry));
                if (Directory.Exists(entry))
                    MoveDirectory(entry, dest);
                else
                    File.Move(entry, dest, true);
            }
            Directory.Delete(tempDir, true);
        }

        await Task.CompletedTask;
        await NotifyMessageAsync(profileId, $"Extracted {definition.BrowserType} {definition.Version}");
    }

    private static void MoveDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            File.Move(file, destFile, true);
        }
        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetFileName(dir));
            MoveDirectory(dir, destDir);
        }
        Directory.Delete(source, true);
    }

    private async Task NotifyMessageAsync(int profileId, string message)
    {
        _onMessageUpdate(new ProfileMessageUpdate { ProfileId = profileId, Message = message });
        _onProfileMessage(profileId, message);
        await Task.CompletedTask;
    }

    private static void Log(string evt, string msg)
    {
        try
        {
            var log = new { ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), evt, msg, src = "BrowserProvisioningService" };
            var path = Path.Combine(AppConfig.BaseDir, "logs", "browser-provision.log");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, System.Text.Json.JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
    }
}
