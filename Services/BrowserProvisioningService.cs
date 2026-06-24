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
        double value = bytes / Math.Pow(1024, i);
        if (i >= 2) return $"{value:F2} {sizes[i]}";
        return $"{Math.Round(value):F0} {sizes[i]}";
    }
}

public class DownloadProgress
{
    public int Progress { get; set; }
    public long DownloadedBytes { get; set; }
    public long TotalBytes { get; set; }
    public string DownloadedText { get; set; } = "";
    public string TotalText { get; set; } = "";
    public string Status { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public bool IsComplete { get; set; }
    public bool IsError { get; set; }
    public string? ErrorMessage { get; set; }
}

public class BrowserProvisioningService
{
    private readonly BrowserCatalogService _catalogService;
    private readonly IInstalledBrowserRepository _installedRepo;
    private readonly Action<ToastPayload> _onToast;
    private readonly Action<ProfileMessageUpdate> _onMessageUpdate;
    private readonly Action<int, string> _onProfileMessage;
    private readonly Action<DownloadProgress>? _onDownloadProgress;

    public BrowserProvisioningService(
        BrowserCatalogService catalogService,
        IInstalledBrowserRepository installedRepo,
        Action<ToastPayload> onToast,
        Action<ProfileMessageUpdate> onMessageUpdate,
        Action<int, string> onProfileMessage,
        Action<DownloadProgress>? onDownloadProgress = null)
    {
        _catalogService = catalogService;
        _installedRepo = installedRepo;
        _onToast = onToast;
        _onMessageUpdate = onMessageUpdate;
        _onProfileMessage = onProfileMessage;
        _onDownloadProgress = onDownloadProgress;
    }

    public async Task<BrowserProvisioningResult> EnsureInstalledAsync(int profileId, string browserType, string browserVersion)
    {
        await NotifyAllAsync(profileId, "starting", $"Checking {browserType} {browserVersion}...");

        var installed = await _installedRepo.GetByTypeAndVersionAsync(browserType, browserVersion);

        if (installed != null)
        {
            var resolvedPath = ResolveExecutablePath(browserType, browserVersion, installed.InstallPath, installed.ExecutablePath);
            if (File.Exists(resolvedPath) && _catalogService.ValidateExecutable(resolvedPath, browserType, browserVersion))
            {
                await NotifyAllAsync(profileId, "ready", $"Browser {browserType} {browserVersion} ready");
                return new BrowserProvisioningResult { Success = true, ExecutablePath = resolvedPath, InstallPath = installed.InstallPath };
            }
            await NotifyAllAsync(profileId, "starting", "Browser files not found, cleaning up...");
            await CleanBrowserFilesAsync(browserType, browserVersion, installed.InstallPath);
        }

        var installDir = _catalogService.GetInstallDirectory(browserType, browserVersion);
        if (Directory.Exists(installDir))
        {
            var exePath = await _catalogService.ResolveExecutablePathAsync(installDir, null);
            if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath) && _catalogService.ValidateExecutable(exePath, browserType, browserVersion))
            {
                await _installedRepo.UpsertAsync(new InstalledBrowser
                {
                    BrowserType = browserType, BrowserVersion = browserVersion,
                    InstallPath = installDir, ExecutablePath = BuildRelativeExecutablePath(browserType, exePath, installDir),
                    InstalledAt = DateTime.UtcNow
                });
                await NotifyAllAsync(profileId, "ready", $"Browser {browserType} {browserVersion} ready");
                return new BrowserProvisioningResult { Success = true, ExecutablePath = exePath, InstallPath = installDir };
            }
            await CleanBrowserFilesAsync(browserType, browserVersion, installDir);
        }

        return new BrowserProvisioningResult { Success = false, Error = "No cached browser found; download required." };
    }

    /// <summary>
    /// Downloads and installs a browser for a shared download session.
    /// SHA256 is verified against the ZIP file BEFORE extraction.
    /// If multiple profiles are waiting on the same session, all are notified.
    /// </summary>
    public async Task<BrowserProvisioningResult> EnsureInstalledForSessionAsync(DownloadSession session, int profileId)
    {
        var browserType = session.BrowserType;
        var browserVersion = session.BrowserVersion;

        var definition = await _catalogService.GetDefinitionAsync(browserType, browserVersion);
        if (definition == null)
        {
            var error = $"Browser {browserType} {browserVersion} not found in catalog";
            await NotifySessionAsync(session, "error", error);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
            session.SetState(SessionState.Failed, error);
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        if (string.IsNullOrEmpty(definition.DownloadUrl))
        {
            var error = $"No download URL for {browserType} {browserVersion}";
            await NotifySessionAsync(session, "error", error);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
            session.SetState(SessionState.Failed, error);
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        await NotifySessionAsync(session, "provisioning", $"Downloading {browserType} {browserVersion}...");
        _onDownloadProgress?.Invoke(new DownloadProgress
        {
            Progress = 0, Status = "Starting download...",
            Subtitle = $"{browserType} {browserVersion}",
            DownloadedText = "0 B", TotalText = "..."
        });

        var installDir = _catalogService.GetInstallDirectory(browserType, browserVersion);
        string? zipPath;
        try
        {
            zipPath = await DownloadFileAsync(session, definition);
        }
        catch (OperationCanceledException)
        {
            var cancelError = "Download cancelled";
            await NotifySessionAsync(session, "error", cancelError);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = cancelError });
            session.SetState(SessionState.Cancelled, cancelError);
            return new BrowserProvisioningResult { Success = false, Error = cancelError };
        }

        if (zipPath == null)
        {
            var error = "Download failed";
            await NotifySessionAsync(session, "error", error);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
            session.SetState(SessionState.Failed, error);
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        // ── Step 1: Verify SHA256 of the ZIP file against template API value ──
        if (!string.IsNullOrEmpty(definition.Sha256))
        {
            session.SetState(SessionState.Verifying);
            _onDownloadProgress?.Invoke(new DownloadProgress
            {
                Progress = 50, Status = "Verifying file integrity...",
                Subtitle = $"{browserType} {browserVersion}"
            });

            var (sha256Ok, computedHash) = await VerifyZipSha256Async(zipPath, definition.Sha256, session);
            if (!sha256Ok)
            {
                var error = $"SHA256 mismatch for {browserType} {browserVersion}. Expected: {definition.Sha256}, Got: {computedHash}";
                await NotifySessionAsync(session, "error", error);
                _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
                session.SetState(SessionState.Failed, error);
                try { File.Delete(zipPath); } catch { }
                try { if (Directory.Exists(installDir)) Directory.Delete(installDir, true); } catch { }
                return new BrowserProvisioningResult { Success = false, Error = error };
            }

            await NotifySessionAsync(session, "provisioning", "SHA256 verified — extracting...");
        }

        // ── Step 2: Extract (unwrap single root folder if present) ──
        session.SetState(SessionState.Extracting);
        _onDownloadProgress?.Invoke(new DownloadProgress
        {
            Progress = 55, Status = "Extracting files...",
            Subtitle = $"{browserType} {browserVersion}"
        });

        string? exePath;
        try
        {
            exePath = await ExtractArchiveAsync(zipPath, installDir, session, definition);
        }
        catch (Exception ex)
        {
            var error = $"Extraction failed: {ex.Message}";
            await NotifySessionAsync(session, "error", error);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
            session.SetState(SessionState.Failed, error);
            try { if (Directory.Exists(installDir)) Directory.Delete(installDir, true); } catch { }
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
        {
            var error = "Browser executable not found after installation";
            await NotifySessionAsync(session, "error", error);
            _onDownloadProgress?.Invoke(new DownloadProgress { IsError = true, ErrorMessage = error });
            session.SetState(SessionState.Failed, error);
            try { if (File.Exists(zipPath)) File.Delete(zipPath); } catch { }
            try { if (Directory.Exists(installDir)) Directory.Delete(installDir, true); } catch { }
            return new BrowserProvisioningResult { Success = false, Error = error };
        }

        // ── Step 3: Persist record and mark success ──
        try { File.Delete(zipPath); } catch { }

        await _installedRepo.UpsertAsync(new InstalledBrowser
        {
            BrowserType = browserType, BrowserVersion = browserVersion,
            InstallPath = installDir,
            ExecutablePath = BuildRelativeExecutablePath(browserType, exePath, installDir),
            InstalledAt = DateTime.UtcNow
        });

        session.ExecutablePath = exePath;
        session.ExtractPath = installDir;
        session.ZipPath = zipPath;
        session.SetState(SessionState.Success);

        await NotifySessionAsync(session, "ready", $"Browser {browserType} {browserVersion} ready");
        _onDownloadProgress?.Invoke(new DownloadProgress
        {
            Progress = 100, IsComplete = true, Status = "Ready!"
        });

        return new BrowserProvisioningResult
        {
            Success = true, ExecutablePath = exePath, InstallPath = installDir
        };
    }

    private async Task<(bool Ok, string ComputedHash)> VerifyZipSha256Async(
        string zipPath, string expectedSha256, DownloadSession session)
    {
        try
        {
            using var sha256 = SHA256.Create();
            await using var stream = File.OpenRead(zipPath);
            var hashBytes = await sha256.ComputeHashAsync(stream);
            var computedHash = Convert.ToHexString(hashBytes).ToLowerInvariant();

            if (!computedHash.Equals(expectedSha256.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                await NotifySessionAsync(session, "error",
                    $"SHA256 mismatch! Expected: {expectedSha256.Trim()}, Got: {computedHash}");
                return (false, computedHash);
            }
            return (true, computedHash);
        }
        catch (Exception ex)
        {
            await NotifySessionAsync(session, "error", $"SHA256 verification error: {ex.Message}");
            return (false, "");
        }
    }

    private async Task<string?> DownloadFileAsync(DownloadSession session, BrowserCatalog definition)
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
            if (File.Exists(tempPath)) try { File.Delete(tempPath); } catch { }

            await using var contentStream = await response.Content.ReadAsStreamAsync();
            await using var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

            var buffer = new byte[8192];
            long totalRead = 0;
            int lastReportedProgress = -1;
            var lastReportTime = DateTime.UtcNow;

            int bytesRead;
            while ((bytesRead = await contentStream.ReadAsync(buffer)) > 0)
            {
                await fileStream.WriteAsync(buffer.AsMemory(0, bytesRead));
                totalRead += bytesRead;

                if (totalBytes > 0)
                {
                    var progress = (int)(totalRead * 100 / totalBytes);
                    var now = DateTime.UtcNow;

                    if (progress != lastReportedProgress || (now - lastReportTime).TotalMilliseconds >= 500)
                    {
                        lastReportedProgress = progress;
                        lastReportTime = now;
                        _onDownloadProgress?.Invoke(new DownloadProgress
                        {
                            Progress = progress,
                            DownloadedBytes = totalRead,
                            TotalBytes = totalBytes,
                            DownloadedText = BytesFormatter.Format(totalRead),
                            TotalText = BytesFormatter.Format(totalBytes),
                            Status = $"Downloading... {progress}%",
                            Subtitle = $"{session.BrowserType} {session.BrowserVersion}"
                        });
                    }
                }
            }

            session.ZipPath = tempPath;
            return tempPath;
        }
        catch (Exception ex)
        {
            Log("DOWNLOAD_FAIL", $"Error: {ex.Message}");
            return null;
        }
    }

    private async Task<string?> ExtractArchiveAsync(
        string zipPath, string installDir, DownloadSession session, BrowserCatalog definition)
    {
        if (Directory.Exists(installDir))
            try { Directory.Delete(installDir, true); } catch { }
        Directory.CreateDirectory(installDir);

        var tempDir = Path.Combine(AppConfig.UpdatesDir, "temp_extract_" + Guid.NewGuid().ToString("N"));
        if (Directory.Exists(tempDir))
            try { Directory.Delete(tempDir, true); } catch { }
        Directory.CreateDirectory(tempDir);

        try
        {
            ZipFile.ExtractToDirectory(zipPath, tempDir, true);
        }
        catch (InvalidDataException)
        {
            if (Directory.Exists(tempDir)) try { Directory.Delete(tempDir, true); } catch { }
            Directory.CreateDirectory(tempDir);
            ZipFile.ExtractToDirectory(zipPath, tempDir, true);
        }

        // ── Unwrap: if zip root is a single folder, flatten it ──
        var rootEntries = Directory.GetFileSystemEntries(tempDir);
        if (rootEntries.Length == 1 && Directory.Exists(rootEntries[0]))
        {
            var singleFolder = rootEntries[0];
            MoveDirectoryContents(singleFolder, installDir);
            try { Directory.Delete(singleFolder, true); } catch { }
        }
        else
        {
            MoveDirectoryContents(tempDir, installDir);
        }

        try { Directory.Delete(tempDir, true); } catch { }

        await NotifySessionAsync(session, "provisioning", $"Extracted {definition.BrowserType} {definition.Version}");
        await FlattenChromeFolderAsync(installDir);

        return _catalogService.ResolveExecutablePathAsync(installDir, definition).GetAwaiter().GetResult();
    }

    private async Task FlattenChromeFolderAsync(string installDir)
    {
        var chromeExe = FindChromeExe(installDir);
        if (chromeExe == null) return;

        var chromeDir = Path.GetDirectoryName(chromeExe);
        if (string.IsNullOrEmpty(chromeDir) || chromeDir.Equals(installDir, StringComparison.OrdinalIgnoreCase))
            return;

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
        var exe = Path.Combine(rootDir, "chrome.exe");
        if (File.Exists(exe)) return exe;
        try
        {
            foreach (var file in Directory.EnumerateFiles(rootDir, "*.exe", SearchOption.AllDirectories))
            {
                if (file.EndsWith("\\chrome.exe", StringComparison.OrdinalIgnoreCase) ||
                    file.EndsWith("/chrome.exe", StringComparison.OrdinalIgnoreCase))
                    return file;
            }
        }
        catch { }
        return null;
    }

    private static void MoveDirectoryContents(string source, string destination)
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
            MoveDirectoryContents(dir, destDir);
        }
    }

    private string ResolveExecutablePath(string browserType, string browserVersion,
        string installPath, string relativeExecutablePath)
    {
        if (Path.IsPathRooted(relativeExecutablePath)) return relativeExecutablePath;
        if (relativeExecutablePath.StartsWith(browserType + "\\") ||
            relativeExecutablePath.StartsWith(browserType + "/"))
            return Path.Combine(AppConfig.BrowserDir, relativeExecutablePath);
        return Path.Combine(installPath, relativeExecutablePath);
    }

    private static string BuildRelativeExecutablePath(string browserType, string absoluteExePath, string installDir)
    {
        var relative = Path.GetRelativePath(AppConfig.BrowserDir, absoluteExePath);
        if (relative.StartsWith("..")) return Path.Combine(browserType, Path.GetFileName(absoluteExePath));
        return relative;
    }

    private async Task CleanBrowserFilesAsync(string browserType, string browserVersion, string installPath)
    {
        try { await _installedRepo.DeleteByTypeAndVersionAsync(browserType, browserVersion); } catch { }
        try { if (Directory.Exists(installPath)) Directory.Delete(installPath, true); } catch { }
        try
        {
            var versionDir = Path.Combine(AppConfig.BrowserDir, browserType, browserVersion);
            if (Directory.Exists(versionDir)) Directory.Delete(versionDir, true);
        }
        catch { }
    }

    private async Task NotifyAllAsync(int profileId, string status, string message)
    {
        _onMessageUpdate(new ProfileMessageUpdate { ProfileId = profileId, Status = status, Message = message });
        _onProfileMessage(profileId, message);
        await Task.CompletedTask;
    }

    /// <summary>
    /// Notifies ALL profiles waiting on this session (initiating + all additional waiters).
    /// </summary>
    private async Task NotifySessionAsync(DownloadSession session, string status, string message)
    {
        foreach (var pid in session.GetAllProfileIds())
        {
            _onMessageUpdate(new ProfileMessageUpdate { ProfileId = pid, Status = status, Message = message });
            _onProfileMessage(pid, message);
        }
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
