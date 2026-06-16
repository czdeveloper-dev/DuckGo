using System.Text.Json;
using System.Text.RegularExpressions;

namespace DuckGo.Validation;

public class ProxyValidator : IValidator
{
    // IPv4: 4 octets (0-255) separated by dots
    private static readonly Regex Ipv4Regex = new(@"^(\d{1,3}\.){3}\d{1,3}$", RegexOptions.Compiled);
    // IPv6: various formats including compressed
    private static readonly Regex Ipv6Regex = new(@"^([0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$", RegexOptions.Compiled);

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

        // name is optional - backend will auto-generate if not provided

        if (!p.Value.TryGetProperty("host", out var h) || string.IsNullOrWhiteSpace(h.GetString()))
            r.WithError("host", "Proxy host is required");
        else
        {
            var host = h.GetString()!;
            // Validate IP address (IPv4 or IPv6)
            var isValidIp = Ipv4Regex.IsMatch(host) || Ipv6Regex.IsMatch(host);
            if (!isValidIp)
                r.WithError("host", "Proxy host must be a valid IPv4 or IPv6 address");
        }

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
            else
            {
                var host = h.GetString()!;
                var isValidIp = Ipv4Regex.IsMatch(host) || Ipv6Regex.IsMatch(host);
                if (!isValidIp)
                    r.WithError("host", "Host must be a valid IPv4 or IPv6 address");
            }

            if (!p.Value.TryGetProperty("port", out var pt) || pt.ValueKind != JsonValueKind.Number)
                r.WithError("port", "Port is required");
            else if (pt.GetInt32() is var port && (port <= 0 || port > 65535))
                r.WithError("port", "Port must be between 1 and 65535");
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
