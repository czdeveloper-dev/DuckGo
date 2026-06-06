using System.Text.Json;

namespace DuckGo.Validation;

public class ProxyValidator : IValidator
{
    public string[] SupportedActions => new[] { "proxy.create", "proxy.update", "proxy.check", "proxy.delete" };

    public ValidationResult Validate(string action, JsonElement? payload)
    {
        return action switch
        {
            "proxy.create" => ValidateCreate(payload),
            "proxy.update" => ValidateUpdate(payload),
            "proxy.check"  => ValidateCheck(payload),
            "proxy.delete" => ValidateDelete(payload),
            _              => ValidationResult.Ok()
        };
    }

    private ValidationResult ValidateCreate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");

        if (!p.Value.TryGetProperty("name", out var n) || string.IsNullOrWhiteSpace(n.GetString()))
            r.WithError("name", "Proxy name is required");

        if (!p.Value.TryGetProperty("host", out var h) || string.IsNullOrWhiteSpace(h.GetString()))
            r.WithError("host", "Proxy host is required");

        if (!p.Value.TryGetProperty("port", out var pt) || pt.ValueKind != JsonValueKind.Number)
            r.WithError("port", "Proxy port is required");
        else if (pt.GetInt32() is var port && (port <= 0 || port > 65535))
            r.WithError("port", "Port must be between 1 and 65535");

        if (p.Value.TryGetProperty("type", out var t) &&
            !new[] { "http", "https", "socks4", "socks5" }.Contains((t.GetString() ?? "").ToLowerInvariant()))
            r.WithError("type", "Type must be http, https, socks4, or socks5");

        return r;
    }

    private ValidationResult ValidateUpdate(JsonElement? p)
    {
        var r = ValidateCreate(p);
        if (!p.HasValue) return r;
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid proxy ID is required");
        return r;
    }

    private ValidationResult ValidateCheck(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");

        // Check can be by saved proxy ID or by direct host/port
        if (!p.Value.TryGetProperty("id", out var idProp) || idProp.ValueKind == JsonValueKind.Null)
        {
            if (!p.Value.TryGetProperty("host", out var h) || string.IsNullOrWhiteSpace(h.GetString()))
                r.WithError("host", "Host is required");
            if (!p.Value.TryGetProperty("port", out var pt) || pt.ValueKind != JsonValueKind.Number)
                r.WithError("port", "Port is required");
        }
        return r;
    }

    private ValidationResult ValidateDelete(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid proxy ID is required");
        return r;
    }
}
