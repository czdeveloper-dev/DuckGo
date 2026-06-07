using System.Diagnostics;
using System.IO;
using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Validation;

namespace DuckGo.Infrastructure.API;

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
            Log($"MD_entry", action, id, null, null, null);

            // Validate before dispatching
            var vr = _validators.Validate(action, payload);
            if (!vr.IsValid)
            {
                var firstError = vr.Errors.Values.FirstOrDefault() ?? "Validation failed";
                var fieldKey = vr.Errors.Keys.FirstOrDefault() ?? "";
                Log($"MD_validation_fail", action, id, null, $"{fieldKey}:{firstError}", null);
                return SerializeResponse(id, false, $"[{fieldKey}] {firstError}", null);
            }

            var (success, error, dataEl) = await ExecuteActionAsync(action, payload);
            var responseJson = SerializeResponse(id, success, error, dataEl);
            // Log the raw response for browser.listVersions and profile.getFingerprintTemplate
            if (action == "browser.listVersions" || action == "profile.getFingerprintTemplate")
            {
                Log($"MD_response", action, id, success, error ?? "ok", responseJson.Length + " chars");
            }
            Log($"MD_exit", action, id, success, error, dataEl.HasValue ? "data_ok" : null);
            return responseJson;
        }
        catch (JsonException ex)
        {
            Debug.WriteLine($"[MessageDispatcher] JsonException for '{action}': {ex}");
            Log($"MD_exception", action, id, false, $"JsonException:{ex.Message}", null);
            return SerializeResponse(id, false, $"Invalid JSON: {ex.Message}", null);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[MessageDispatcher] Exception for '{action}': {ex}");
            Log($"MD_exception", action, id, false, $"Exception:{ex.Message}", null);
            return SerializeResponse(id, false, ex.Message, null, noToast: true);
        }
    }

    private async Task<(bool Success, string? Error, JsonElement? Data)> ExecuteActionAsync(
        string action, JsonElement? payload)
    {
        foreach (var dispatcher in _dispatchers)
        {
            if (dispatcher.CanHandle(action))
            {
                Log($"MD_dispatcher_match", action, null, null, dispatcher.GetType().Name, null);
                return await dispatcher.DispatchAsync(action, payload);
            }
        }
        Log($"MD_no_handler", action, null, false, "no handler found", null);
        return (false, $"Unknown action: {action}", null);
    }

    private static void Log(string eventType, string action, int? id, bool? success, string? error, string? extra)
    {
        try
        {
            var log = new
            {
                sessionId = "971020",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                evt = eventType,
                action,
                id = id ?? 0,
                success = success ?? (bool?)null,
                error = error ?? (string?)null,
                extra = extra ?? (string?)null
            };
            var path = @"d:\Software\DuckAutomation\DuckGo\debug-971020.log";
            File.AppendAllText(path, System.Text.Json.JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
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
