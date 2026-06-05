using System.Net.Http;
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

    private static readonly HttpClient HttpClient = new();

    public async Task<BrowserCatalogResponse> GetBrowserCatalogAsync()
    {
        using var response = await HttpClient.GetAsync(AppConfig.BrowserVersionsConfigUrl);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();

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
