using System.IO;
using System.Reflection;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class BrowserVersionService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
    private static readonly string LocalFilePath =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                     "DuckGo", "BrowserVersions", "browser_versions.json");

    public async Task<BrowserCatalogResponse> GetBrowserCatalogAsync()
    {
        string json;

        if (File.Exists(LocalFilePath))
        {
            json = await File.ReadAllTextAsync(LocalFilePath);
        }
        else
        {
            // Try load from extracted Assets folder
            var assetFile = AppConfig.BrowserVersionsConfigPath;
            if (!string.IsNullOrEmpty(assetFile) && File.Exists(assetFile))
            {
                json = await File.ReadAllTextAsync(assetFile);
                // Cache to local so next startup is instant
                var dir = Path.GetDirectoryName(LocalFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);
                await File.WriteAllTextAsync(LocalFilePath, json);
            }
            else
            {
                json = await LoadEmbeddedAsync();
                // Cache to local
                var dir = Path.GetDirectoryName(LocalFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);
                await File.WriteAllTextAsync(LocalFilePath, json);
            }
        }

        var config = JsonSerializer.Deserialize<BrowserVersionsConfig>(json, JsonOptions)
            ?? throw new InvalidOperationException("Browser versions config could not be parsed.");

        if (config.Browsers.Count == 0)
        {
            throw new InvalidOperationException("Browser versions config does not contain any browsers.");
        }

        return new BrowserCatalogResponse
        {
            Browsers = config.Browsers
                .Where(b => !string.IsNullOrWhiteSpace(b.BrowserType))
                .Select(b => new BrowserDefinitionResponse
                {
                    BrowserType = b.BrowserType,
                    Versions = b.Versions
                        .Where(v => !string.IsNullOrWhiteSpace(v.Version))
                        .Select(v => new BrowserVersionItemResponse
                        {
                            Version = v.Version,
                            Description = v.Description,
                            DownloadUrl = v.DownloadUrl,
                            Md5 = v.Md5
                        })
                        .ToList()
                })
                .ToList()
        };
    }

    private static async Task<string> LoadEmbeddedAsync()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = "DuckGo.Assets.browser_versions.json";
        await using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new FileNotFoundException(
                $"Browser versions config not found locally and remote download failed. Embedded resource '{resourceName}' also not found.");
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync();
    }
}
