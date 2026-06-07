using System.IO;
using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class BrowserDispatcher : IDispatcher
{
    private readonly BrowserLifecycleService _browserService;

    public BrowserDispatcher(BrowserLifecycleService browserService)
    {
        _browserService = browserService;
    }

    public string Domain => "browser";

    public bool CanHandle(string action) =>
        action is "browser.start" or "browser.stop" or "browser.status" or "browser.listVersions";

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        try
        {
            return action switch
            {
                "browser.start" => await StartAsync(payload),
                "browser.stop" => await StopAsync(payload),
                "browser.status" => await StatusAsync(payload),
                _ => (false, $"Unknown action: {action}", null)
            };
        }
        catch (Exception ex)
        {
            BDLog("FAIL", $"action={action} error={ex.Message}");
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> StartAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing profile id", null);

        BDLog("START", $"profileId={id.Value}");
        var result = await _browserService.StartBrowserAsync(id.Value);
        BDLog("START_RESULT", $"profileId={id.Value} success={result.Success} error={result.Error ?? "ok"}");

        if (result.Success)
        {
            return (true, null, WrapInElement(new { status = result.Status, cdpPort = result.CdpPort }));
        }
        else
        {
            return (false, result.Error ?? "Failed to start browser", null);
        }
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> StopAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing profile id", null);

        BDLog("STOP", $"profileId={id.Value}");
        var result = await _browserService.StopBrowserAsync(id.Value);

        return result.Success
            ? (true, null, WrapInElement(new { status = "stopped" }))
            : (false, result.Error ?? "Failed to stop browser", null);
    }

    private Task<(bool Success, string? Error, JsonElement? Data)> StatusAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return Task.FromResult(((bool Success, string? Error, JsonElement? Data))(false, "Missing profile id", null));

        var info = _browserService.GetBrowserInfo(id.Value);
        return Task.FromResult<(bool, string?, JsonElement?)>(
            (true, null, WrapInElement(new { running = info.IsRunning, cdpPort = info.CdpPort })));
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
            var log = new { sessionId = "971020", ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), evt, msg, src = "BrowserDispatcher" };
            var path = Path.Combine(AppConfig.BaseDir, "logs", "browser-dispatcher.log");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, System.Text.Json.JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
    }
}
