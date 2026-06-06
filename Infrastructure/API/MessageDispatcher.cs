using System;
using System.Text.Json;
using System.Diagnostics;
using DuckGo.Models.DTOs;
using DuckGo.Validation;

namespace DuckGo.Infrastructure.API;

/// <summary>
/// Unified message dispatcher — single entry point for all JS ↔ C# communication.
/// Uses per-domain IDispatcher implementations for each action group.
/// Validates all incoming requests via ValidatorFactory before dispatch.
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
    private readonly ValidatorFactory _validators = new();

    public MessageDispatcher(IEnumerable<IDispatcher> dispatchers)
    {
        _dispatchers = dispatchers.ToList();
    }

    public static ApiResponse Fail(string error, string? title = null, string? message = null)
        => new()
        {
            Success = false,
            Error = error,
            Toast = new ApiToast
            {
                Title = title ?? "Error",
                Message = message ?? error,
                Type = "error"
            }
        };

    [System.Diagnostics.DebuggerStepThrough]
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

            Debug.WriteLine($"[MessageDispatcher] action={action} id={id}");

            // Validate before dispatching
            var vr = _validators.Validate(action, payload);
            if (!vr.IsValid)
            {
                var firstError = vr.Errors.Values.FirstOrDefault() ?? "Validation failed";
                var fieldKey = vr.Errors.Keys.FirstOrDefault() ?? "";
                return SerializeResponse(id, false, $"[{fieldKey}] {firstError}", null);
            }

            var (success, error, dataEl) = await ExecuteActionAsync(action, payload);
            return SerializeResponse(id, success, error, dataEl);
        }
        catch (JsonException ex)
        {
            Debug.WriteLine($"[MessageDispatcher] JsonException for '{action}': {ex}");
            return SerializeResponse(id, false, $"Invalid JSON: {ex.Message}", null);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[MessageDispatcher] Exception for '{action}': {ex}");
            // Internal errors: suppress toast — these are bugs, not user-facing messages.
            // The error is still returned to JS so Promise.allSettled/logging captures it.
            return SerializeResponse(id, false, ex.Message, null, noToast: true);
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

    private static string SerializeResponse(int id, bool success, string? error, JsonElement? data, bool noToast = false)
    {
        var sb = new System.Text.StringBuilder(256);
        sb.Append("{\"type\":\"response\",\"id\":");
        sb.Append(id);
        sb.Append(",\"success\":");
        sb.Append(success ? "true" : "false");

        if (!string.IsNullOrEmpty(error))
        {
            sb.Append(",\"error\":");
            sb.Append(JsonSerializer.Serialize(error));
            if (!noToast)
            {
                sb.Append(",\"toast\":");
                sb.Append(JsonSerializer.Serialize(new ApiToast
                {
                    Title = "Error",
                    Message = error.Length > 400 ? error[..400] : error,
                    Type = "error"
                }));
            }
        }
        else if (data.HasValue)
        {
            sb.Append(",\"data\":");
            sb.Append(data.Value.GetRawText());
        }

        sb.Append('}');
        return sb.ToString();
    }
}
