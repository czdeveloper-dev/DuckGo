using System.Text.Json;

namespace DuckGo.Infrastructure.API;

/// <summary>
/// Unified message dispatcher — single entry point for all JS ↔ C# communication.
/// Uses per-domain IDispatcher implementations for each action group.
///
/// Protocol:
///   JS → C#  { type: "request", id, action, payload }
///   C# → JS  { type: "response", id, success, error, data }
///   C# → JS  { type: "push", channel, payload }   (server-initiated, no id)
///
/// Action format:  "entity.verb"   e.g.  "group.list", "tag.create", "profile.delete"
/// Channel format: "entity.changed"  e.g.  "profile.changed", "group.changed"
/// </summary>
public class MessageDispatcher
{
    private readonly List<IDispatcher> _dispatchers;

    public MessageDispatcher(IEnumerable<IDispatcher> dispatchers)
    {
        _dispatchers = dispatchers.ToList();
    }

    public async Task<string> DispatchAsync(string json)
    {
        int id = 0;
        string action = "";
        JsonElement? payload = null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("id",     out var idProp))    id      = idProp.GetInt32();
            if (root.TryGetProperty("action",  out var actProp))  action  = actProp.GetString() ?? "";
            if (root.TryGetProperty("payload", out var plProp))   payload = plProp;

            var (success, error, dataEl) = await ExecuteActionAsync(action, payload);
            return SerializeResponse(id, success, error, dataEl);
        }
        catch (JsonException ex)
        {
            return SerializeResponse(id, false, $"Invalid JSON: {ex.Message}", null);
        }
        catch (Exception ex)
        {
            return SerializeResponse(id, false, ex.Message, null);
        }
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> ExecuteActionAsync(
        string action, JsonElement? payload)
    {
        foreach (var dispatcher in _dispatchers)
        {
            if (dispatcher.CanHandle(action))
                return await dispatcher.DispatchAsync(action, payload);
        }
        return (false, $"Unknown action: {action}", null);
    }

    private static string SerializeResponse(int id, bool success, string? error, JsonElement? data)
    {
        var sb = new System.Text.StringBuilder(256);
        sb.Append("{\"type\":\"response\",\"id\":");
        sb.Append(id);
        sb.Append(",\"success\":");
        sb.Append(success ? "true" : "false");
        if (error != null)
        {
            sb.Append(",\"error\":");
            sb.Append(JsonSerializer.Serialize(error));
        }
        if (data.HasValue)
        {
            sb.Append(",\"data\":");
            sb.Append(data.Value.GetRawText());
        }
        sb.Append('}');
        return sb.ToString();
    }
}
