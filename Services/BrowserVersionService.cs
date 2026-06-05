using System.IO;
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

    public async Task<BrowserCatalogResponse> GetBrowserCatalogAsync()
    {
        var assetPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "browser_versions.json");
        var json = await File.ReadAllTextAsync(assetPath);

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
}
