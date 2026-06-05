using System.Text.Json;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class FingerprintDispatcher : IDispatcher
{
    private readonly FingerprintService _svc;
    private readonly string[] _actions = ["profile.generateFingerprint"];

    public string Domain => "profile";

    public FingerprintDispatcher(FingerprintService svc) => _svc = svc;

    public bool CanHandle(string action) => _actions.Contains(action);

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        try
        {
            string? platform = null, browser = null, osModel = null;
            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("platform", out var pl)) platform = pl.GetString();
                if (p.TryGetProperty("browser",  out var br)) browser  = br.GetString();
                if (p.TryGetProperty("model",    out var md)) osModel  = md.GetString();
            }

            var result = await _svc.GenerateSummaryAsync(platform, browser, osModel);
            return (true, null, WrapInElement(result));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }
}
