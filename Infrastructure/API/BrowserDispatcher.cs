using System.IO;
using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class BrowserDispatcher : IDispatcher
{
    private readonly BrowserLifecycleService _browserService;
    private readonly BrowserVersionService _browserVersionService;

    public BrowserDispatcher(BrowserLifecycleService browserService, BrowserVersionService browserVersionService)
    {
        _browserService = browserService;
        _browserVersionService = browserVersionService;
    }

    public string Domain => "browser";

    public bool CanHandle(string action) =>
        action is "browser.start" or "browser.stop" or "browser.status" or "browser.listVersions"
        or "browser.bulkStart" or "browser.bulkStop";

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        try
        {
            return action switch
            {
                "browser.start" => await StartAsync(payload),
                "browser.stop" => await StopAsync(payload),
                "browser.status" => await StatusAsync(payload),
                "browser.listVersions" => await ListVersionsAsync(),
                "browser.bulkStart" => await BulkStartAsync(payload),
                "browser.bulkStop" => await BulkStopAsync(payload),
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

        BDLog("START", $"profileId={id.Value} thread={System.Threading.Thread.CurrentThread.ManagedThreadId}");
        try
        {
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
        catch (Exception ex)
        {
            BDLog("START_ERROR", $"profileId={id.Value} ex={ex.GetType().Name} msg={ex.Message} stack={ex.StackTrace}");
            return (false, $"{ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}", null);
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

    private async Task<(bool Success, string? Error, JsonElement? Data)> ListVersionsAsync()
    {
        BDLog("LIST_VERSIONS", "Starting");
        var catalog = await _browserVersionService.GetBrowserCatalogAsync();
        BDLog("LIST_VERSIONS", $"Browsers={catalog.Browsers.Count}");
        return (true, null, WrapInElement(catalog));
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> BulkStartAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        List<int> ids;
        try
        {
            ids = payload.Value.EnumerateArray().Select(e => e.GetInt32()).ToList();
        }
        catch
        {
            return (false, "Invalid profile ids", null);
        }

        BDLog("BULK_START", $"count={ids.Count}");
        var results = new List<object>();
        foreach (var id in ids)
        {
            try
            {
                var r = await _browserService.StartBrowserAsync(id);
                results.Add(new { id, success = r.Success, error = r.Error });
            }
            catch (Exception ex)
            {
                results.Add(new { id, success = false, error = ex.Message });
            }
        }

        var successCount = results.Count(r => (bool)((dynamic)r).success);
        BDLog("BULK_START_DONE", $"success={successCount}/{ids.Count}");
        return (true, null, WrapInElement(new { total = ids.Count, successCount, results }));
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> BulkStopAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        List<int> ids;
        try
        {
            ids = payload.Value.EnumerateArray().Select(e => e.GetInt32()).ToList();
        }
        catch
        {
            return (false, "Invalid profile ids", null);
        }

        BDLog("BULK_STOP", $"count={ids.Count}");
        var results = new List<object>();
        foreach (var id in ids)
        {
            try
            {
                var r = await _browserService.StopBrowserAsync(id);
                results.Add(new { id, success = r.Success, error = r.Error });
            }
            catch (Exception ex)
            {
                results.Add(new { id, success = false, error = ex.Message });
            }
        }

        var successCount = results.Count(r => (bool)((dynamic)r).success);
        BDLog("BULK_STOP_DONE", $"success={successCount}/{ids.Count}");
        return (true, null, WrapInElement(new { total = ids.Count, successCount, results }));
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
