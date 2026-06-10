using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public static class BytesFormatter
{
    public static string Format(long bytes)
    {
        if (bytes <= 0) return "0 B";
        string[] sizes = ["B", "KB", "MB", "GB", "TB"];
        int i = (int)Math.Floor(Math.Log(bytes) / Math.Log(1024));
        i = Math.Min(i, sizes.Length - 1);
        return Math.Round(bytes / Math.Pow(1024, i), 1) + " " + sizes[i];
    }
}

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
        await NotifyMessageAsync(profileId, $"Checking {browserType} {browserVersion}...");

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

        // Fallback: check if browser files already exist on disk
        var installDir = _catalogService.GetInstallDirectory(browserType, browserVersion);
        if (Directory.Exists(installDir))
        {
            var exePath = await _catalogService.ResolveExecutablePathAsync(installDir, null);
            if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
            {
                var isValid = _catalogService.ValidateExecutable(exePath, browserType, browserVersion);

                if (isValid)
                {
                    // Save to DB and return
                    await _installedRepo.UpsertAsync(new InstalledBrowser
                    {
                        BrowserType = browserType,
                        BrowserVersion = browserVersion,
                        InstallPath = installDir,
                        ExecutablePath = exePath,
                        InstalledAt = DateTime.UtcNow
                    });
                    await NotifyMessageAsync(profileId, $"Browser {browserType} {browserVersion} ready");
                    return new BrowserProvisioningResult { Success = true, ExecutablePath = exePath, InstallPath = installDir };
                }
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
        _onToast(ToastPayload.Progress(toastId, $"Downloading {browserType} {browserVersion}",
            "0 B", "...", 0, "Starting download..."));

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
            _onToast(ToastPayload.Progress(toastId, $"Installing {browserType} {browserVersion}",
                "", "", 50, "Extracting files..."));

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
            int lastReportedProgress = -1;
            var lastReportTime = DateTime.UtcNow;

            while ((bytesRead = await contentStream.ReadAsync(buffer)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead));
                totalRead += bytesRead;

                if (totalBytes > 0)
                {
                    var progress = (int)(totalRead * 100 / totalBytes);
                    var now = DateTime.UtcNow;

                    // Throttle: only send toast if progress changed OR 500ms passed
                    if (progress != lastReportedProgress || (now - lastReportTime).TotalMilliseconds >= 500)
                    {
                        lastReportedProgress = progress;
                        lastReportTime = now;
                        await NotifyMessageAsync(profileId, $"Downloading {definition.BrowserType} {definition.Version}... {progress}%");
                        _onToast(ToastPayload.Progress(toastId, $"Downloading {definition.BrowserType} {definition.Version}",
                            BytesFormatter.Format(totalRead), BytesFormatter.Format(totalBytes), progress, "Downloading..."));
                    }
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

        // Clean install directory first
        if (Directory.Exists(installDir))
        {
            try { Directory.Delete(installDir, true); } catch { }
        }
        Directory.CreateDirectory(installDir);

        try
        {
            if (File.Exists(zipPath))
                ZipFile.ExtractToDirectory(zipPath, installDir, true);
        }
        catch (InvalidDataException)
        {
            // Fallback: extract to temp, then move contents
            var tempDir = Path.Combine(AppConfig.UpdatesDir, "temp_extract_" + Guid.NewGuid().ToString("N"));
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
            Directory.CreateDirectory(tempDir);
            ZipFile.ExtractToDirectory(zipPath, tempDir, true);

            // Move all contents from temp to installDir
            MoveDirectoryContents(tempDir, installDir);
            try { Directory.Delete(tempDir, true); } catch { }
        }

        await NotifyMessageAsync(profileId, $"Extracted {definition.BrowserType} {definition.Version}");

        // Flatten if chrome.exe is in a subfolder (e.g., Chrome-bin/chrome.exe -> chrome.exe)
        await FlattenChromeFolderAsync(installDir, definition);
    }

    private async Task FlattenChromeFolderAsync(string installDir, BrowserCatalog definition)
    {
        // Check if chrome.exe is in a subfolder and move it up
        var chromeExe = FindChromeExe(installDir);
        if (chromeExe == null) return;

        var chromeDir = Path.GetDirectoryName(chromeExe);
        if (string.IsNullOrEmpty(chromeDir) || chromeDir.Equals(installDir, StringComparison.OrdinalIgnoreCase))
            return; // Already at root

        // Move all contents from subfolder to installDir
        try
        {
            foreach (var entry in Directory.GetFileSystemEntries(chromeDir))
            {
                var dest = Path.Combine(installDir, Path.GetFileName(entry));
                if (Directory.Exists(entry))
                {
                    if (Directory.Exists(dest)) Directory.Delete(dest, true);
                    Directory.Move(entry, dest);
                }
                else if (File.Exists(entry))
                {
                    if (File.Exists(dest)) File.Delete(dest);
                    File.Move(entry, dest);
                }
            }

            // Remove the now-empty subfolder
            try { Directory.Delete(chromeDir, true); } catch { }

            Log("FLATTEN", $"Moved contents from {chromeDir} to {installDir}");
        }
        catch (Exception ex)
        {
            Log("FLATTEN_FAIL", $"Could not flatten: {ex.Message}");
        }

        await Task.CompletedTask;
    }

    private string? FindChromeExe(string rootDir)
    {
        if (!Directory.Exists(rootDir)) return null;

        // Try direct path first
        var exe = Path.Combine(rootDir, "chrome.exe");
        if (File.Exists(exe)) return exe;

        // Search recursively for chrome.exe
        try
        {
            foreach (var file in Directory.EnumerateFiles(rootDir, "*.exe", SearchOption.AllDirectories))
            {
                if (file.EndsWith("\\chrome.exe", StringComparison.OrdinalIgnoreCase) ||
                    file.EndsWith("/chrome.exe", StringComparison.OrdinalIgnoreCase))
                {
                    return file;
                }
            }
        }
        catch { }

        return null;
    }

    private void MoveDirectoryContents(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            if (File.Exists(destFile)) File.Delete(destFile);
            File.Move(file, destFile);
        }

        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetDirectoryName(dir));
            MoveDirectoryContents(dir, destDir);
        }
    }

    private async Task NotifyMessageAsync(int profileId, string message)
    {
        _onMessageUpdate(new ProfileMessageUpdate { ProfileId = profileId, Message = message });
        _onProfileMessage(profileId, message);
        await Task.CompletedTask;
    }

    private static void MoveDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var file in Directory.GetFiles(source))
        {
            var destFile = Path.Combine(destination, Path.GetFileName(file));
            if (File.Exists(destFile)) File.Delete(destFile);
            File.Move(file, destFile);
        }
        foreach (var dir in Directory.GetDirectories(source))
        {
            var destDir = Path.Combine(destination, Path.GetFileName(dir));
            MoveDirectory(dir, destDir);
        }
        try { Directory.Delete(source, true); } catch { }
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
