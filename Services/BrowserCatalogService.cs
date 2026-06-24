using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class BrowserCatalogService
{
    private static readonly HttpClient _httpClient;

    static BrowserCatalogService()
    {
        var handler = new HttpClientHandler { UseProxy = true, Proxy = WebRequest.DefaultWebProxy };
        _httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private BrowserVersionsConfig? _cachedCatalog;
    private DateTime _catalogCacheTime;
    private static readonly TimeSpan CatalogCacheDuration = TimeSpan.FromMinutes(15);

    public async Task<List<BrowserCatalog>> GetCatalogAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cachedCatalog != null && DateTime.UtcNow - _catalogCacheTime < CatalogCacheDuration)
        {
            return FlattenCatalog(_cachedCatalog);
        }

        try
        {
            var json = await _httpClient.GetStringAsync(AppConfig.BrowserVersionsConfigUrl);
            _cachedCatalog = JsonSerializer.Deserialize<BrowserVersionsConfig>(json, JsonOptions)
                ?? throw new InvalidOperationException("Browser versions config could not be parsed.");
            _catalogCacheTime = DateTime.UtcNow;
            return FlattenCatalog(_cachedCatalog);
        }
        catch (Exception ex)
        {
            Log("CATALOG_FAIL", $"Error fetching catalog: {ex.Message}");
            if (_cachedCatalog != null) return FlattenCatalog(_cachedCatalog);
            throw;
        }
    }

    public async Task<BrowserCatalog?> GetDefinitionAsync(string browserType, string browserVersion)
    {
        var catalog = await GetCatalogAsync();
        return catalog.FirstOrDefault(b =>
            b.BrowserType.Equals(browserType, StringComparison.OrdinalIgnoreCase) &&
            b.Version.Equals(browserVersion, StringComparison.OrdinalIgnoreCase));
    }

    public string GetInstallDirectory(string browserType, string browserVersion)
    {
        return Path.Combine(AppConfig.BrowserDir, browserType, browserVersion);
    }

    public async Task<string?> ResolveExecutablePathAsync(string installDir, BrowserCatalog? definition)
    {
        if (definition != null && !string.IsNullOrEmpty(definition.ExecutableRelativePath))
        {
            var exePath = Path.Combine(installDir, definition.ExecutableRelativePath);
            if (File.Exists(exePath))
                return exePath;
        }

        // Fallback: search for chrome.exe in common locations
        var commonPaths = new[] {
            "chrome.exe",
            "chromium.exe",
            Path.Combine("chrome-win", "chrome.exe"),
            Path.Combine("chrome-linux", "chrome"),
            "firefox.exe",
            "firefox.exe",
        };

        foreach (var relPath in commonPaths)
        {
            var exePath = Path.Combine(installDir, relPath);
            if (File.Exists(exePath))
                return exePath;
        }

        // Deep search
        if (Directory.Exists(installDir))
        {
            var files = Directory.GetFiles(installDir, "*.exe", SearchOption.AllDirectories);
            foreach (var f in files)
            {
                var name = Path.GetFileName(f).ToLowerInvariant();
                if (name.Contains("chrome") || name.Contains("chromium") || name.Contains("firefox"))
                    return f;
            }
        }

        return null;
    }

    public async Task<(string? Version, string? ProductVersion)> ReadExecutableVersionAsync(string exePath)
    {
        if (!File.Exists(exePath))
            return (null, null);

        try
        {
            var versionInfo = FileVersionInfo.GetVersionInfo(exePath);
            return (versionInfo.FileVersion, versionInfo.ProductVersion);
        }
        catch
        {
            return (null, null);
        }
    }

    public bool ValidateExecutable(string exePath, string expectedType, string expectedVersion)
    {
        if (!File.Exists(exePath))
            return false;

        try
        {
            var (fileVersion, _) = ReadExecutableVersionAsync(exePath).GetAwaiter().GetResult();
            if (string.IsNullOrEmpty(fileVersion))
                return false;

            return fileVersion.StartsWith(expectedVersion, StringComparison.OrdinalIgnoreCase) ||
                   fileVersion.Split('.').FirstOrDefault() == expectedVersion.Split('.').FirstOrDefault();
        }
        catch
        {
            return false;
        }
    }

    private static List<BrowserCatalog> FlattenCatalog(BrowserVersionsConfig config)
    {
        var list = new List<BrowserCatalog>();
        foreach (var def in config.Browsers)
        {
            foreach (var ver in def.Versions)
            {
                list.Add(new BrowserCatalog
                {
                    BrowserType = def.BrowserType,
                    Version = ver.Version,
                    Description = ver.Description,
                    DownloadUrl = ver.DownloadUrl,
                    Md5 = ver.Md5,
                    Sha256 = ver.Sha256,
                    ExecutableRelativePath = GetExecutablePathForBrowser(def.BrowserType),
                    ArchiveType = "zip"
                });
            }
        }
        return list;
    }

    private static string GetExecutablePathForBrowser(string browserType)
    {
        return browserType.ToLowerInvariant() switch
        {
            "chrome" or "chromium" => @"chrome-win\chrome.exe",
            "firefox" => @"firefox\firefox.exe",
            "edge" => @"chrome-win\chrome.exe",
            _ => @"chrome-win\chrome.exe"
        };
    }

    private static void Log(string evt, string msg)
    {
        try
        {
            var log = new
            {
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                evt,
                msg,
                src = "BrowserCatalogService"
            };
            var path = Path.Combine(AppConfig.BaseDir, "logs", "browser-catalog.log");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
    }
}
