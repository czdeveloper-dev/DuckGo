using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class BrowserVersionService
{
    private static readonly HttpClient _httpClient;

    static BrowserVersionService()
    {
        var handler = new HttpClientHandler
        {
            UseProxy = true,
            Proxy = WebRequest.DefaultWebProxy
        };
        _httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<BrowserCatalogResponse> GetBrowserCatalogAsync()
    {
        try
        {
            BVSLog("START", $"Fetching {AppConfig.BrowserVersionsConfigUrl}");
            var json = await _httpClient.GetStringAsync(AppConfig.BrowserVersionsConfigUrl);
            BVSLog("JSON_RECEIVED", $"JSON length={json.Length}, first 100 chars: {json.Substring(0, Math.Min(100, json.Length))}");

            var config = JsonSerializer.Deserialize<BrowserVersionsConfig>(json, JsonOptions)
                ?? throw new InvalidOperationException("Browser versions config could not be parsed.");

            if (config.Browsers.Count == 0)
                throw new InvalidOperationException("Browser versions config does not contain any browsers.");

            BVSLog("SUCCESS", $"Browsers count={config.Browsers.Count}");
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
                                Md5 = v.Md5,
                                Sha256 = v.Sha256
                            }).ToList()
                    }).ToList()
            };
        }
        catch (Exception ex)
        {
            BVSLog("FAIL", $"Error: {ex.Message}, Stack: {ex.StackTrace}");
            throw;
        }
    }

    private static void BVSLog(string evt, string msg)
    {
        try
        {
            var log = new
            {
                sessionId = "971020",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                evt,
                msg,
                src = "BrowserVersionService"
            };
            var path = @"d:\Software\DuckAutomation\DuckGo\bvs-log-971020.log";
            File.AppendAllText(path, JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
    }
}
