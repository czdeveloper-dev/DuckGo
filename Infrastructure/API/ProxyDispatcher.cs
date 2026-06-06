using System.Text.Json;

namespace DuckGo.Infrastructure.API;

public class ProxyDispatcher : IDispatcher
{
    private readonly Services.ProxyService _service;

    public string Domain => "proxy";

    public ProxyDispatcher(Services.ProxyService service) => _service = service;

    public bool CanHandle(string action) => action.StartsWith("proxy.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "proxy.list" => await ListAsync(),
            "proxy.create" => await CreateAsync(payload),
            "proxy.update" => await UpdateAsync(payload),
            "proxy.delete" => await DeleteAsync(payload),
            "proxy.check" => await CheckAsync(payload),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync()
    {
        var result = await _service.GetProxiesAsync();
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.ProxyCreateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        var proxyId = await _service.CreateProxyAsync(req);
        return (true, null, WrapInElement(new { id = proxyId }));
    }

    private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.ProxyUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        await _service.UpdateProxyAsync(req);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);
        await _service.DeleteProxyAsync(id.Value);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> CheckAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        if (payload.Value.TryGetProperty("id", out var idProp) && idProp.ValueKind != JsonValueKind.Null)
        {
            var result = await _service.CheckProxyAsync(idProp.GetInt32());
            return (true, null, WrapInElement(result));
        }

        var req = ParsePayload<Models.DTOs.ProxyCheckRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        var result2 = await _service.CheckProxyAsync(req);
        return (true, null, WrapInElement(result2));
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }

    private static T? ParsePayload<T>(JsonElement? payload) where T : class
    {
        if (!payload.HasValue) return null;
        try
        {
            return JsonSerializer.Deserialize<T>(payload.Value.GetRawText(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { return null; }
    }
}
