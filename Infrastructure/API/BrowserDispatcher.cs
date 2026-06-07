using System.IO;
using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class BrowserDispatcher : IDispatcher
{
    private readonly BrowserVersionService _service;

    public BrowserDispatcher(BrowserVersionService service)
    {
        _service = service;
    }

    public string Domain => "browser";

    public bool CanHandle(string action) => action == "browser.listVersions";

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        try
        {
            BDLog("START", $"action={action}");
            var catalog = await _service.GetBrowserCatalogAsync();
            BDLog("OK", $"catalog.Browsers.Count={catalog.Browsers.Count}");
            return (true, null, WrapInElement(catalog));
        }
        catch (Exception ex)
        {
            BDLog("FAIL", $"Error: {ex.Message}");
            return (false, ex.Message, null);
        }
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }

    private static void BDLog(string evt, string msg)
    {
        try
        {
            var log = new
            {
                sessionId = "971020",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                evt,
                msg,
                src = "BrowserDispatcher"
            };
            var path = @"d:\Software\DuckAutomation\DuckGo\bd-log-971020.log";
            File.AppendAllText(path, System.Text.Json.JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
    }
}
