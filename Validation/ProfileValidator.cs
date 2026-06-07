using System.Text.Json;
using System.Text.Json.Nodes;

namespace DuckGo.Validation;

public class ProfileValidator : IValidator
{
    public string[] SupportedActions => new[]
    {
        // Write actions only — read-only (.list/.get) are skipped by ValidatorFactory
        "profile.create", "profile.update", "profile.bulkCreate",
        "profile.duplicate", "profile.delete",
        "proxy.create", "proxy.update", "proxy.delete",
        "group.create", "group.update", "group.delete",
        "tag.create", "tag.update", "tag.delete",
    };

    public ValidationResult Validate(string action, JsonElement? payload)
    {
        return action switch
        {
            "profile.create"    => ValidateCreate(payload),
            "profile.update"    => ValidateUpdate(payload),
            "profile.bulkCreate" => ValidateBulkCreate(payload),
            "profile.duplicate" => ValidateDuplicate(payload),
            "profile.delete"    => ValidateDelete(payload),
            "profile.list"      => ValidationResult.Ok(),
            "profile.get"       => ValidationResult.Ok(),
            _                    => ValidationResult.Ok()
        };
    }

    private ValidationResult ValidateCreate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");

        var bt = p.Value.TryGetProperty("browserType", out var btEl) ? btEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(bt))
            r.WithError("browserType", "Browser type is required");
        else if (!NormalizeBrowserType(bt, out _))
            r.WithError("browserType", "Browser type must be Chromium or Firefox");

        ValidateUserAgent(p.Value, r);
        ValidateProxy(p.Value, r);
        return r;
    }

    private ValidationResult ValidateBulkCreate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");

        if (p.Value.TryGetProperty("quantity", out var qty) && qty.ValueKind == JsonValueKind.Number)
        {
            var q = qty.GetInt32();
            if (q < 1) r.WithError("quantity", "Quantity must be at least 1");
            if (q > 500) r.WithError("quantity", "Quantity cannot exceed 500");
        }

        var bt = p.Value.TryGetProperty("browserType", out var btEl) ? btEl.GetString() : null;
        if (string.IsNullOrWhiteSpace(bt))
            r.WithError("browserType", "Browser type is required");

        ValidateUserAgent(p.Value, r);
        ValidateProxy(p.Value, r);
        return r;
    }

    private ValidationResult ValidateUpdate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid profile ID is required");
        return r;
    }

    private ValidationResult ValidateDuplicate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid profile ID is required");
        return r;
    }

    private ValidationResult ValidateDelete(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid profile ID is required");
        return r;
    }

    private void ValidateProxy(JsonElement p, ValidationResult r)
    {
        if (!p.TryGetProperty("fingerprint", out var fp) ||
            !fp.TryGetProperty("proxy", out var proxy)) return;

        if (!proxy.TryGetProperty("mode", out var modeEl)) return;
        var mode = (modeEl.GetString() ?? "").ToLowerInvariant();
        if (mode != "custom") return;

        if (!proxy.TryGetProperty("host", out var host) ||
            string.IsNullOrWhiteSpace(host.GetString()))
            r.WithError("proxy.host", "Proxy host is required for custom proxy");

        if (!proxy.TryGetProperty("port", out var port) ||
            port.ValueKind != JsonValueKind.Number)
            r.WithError("proxy.port", "Proxy port is required for custom proxy");

        if (proxy.TryGetProperty("type", out var typeEl))
        {
            var t = (typeEl.GetString() ?? "").ToLowerInvariant();
            if (!new[] { "http", "https", "socks4", "socks5" }.Contains(t))
                r.WithError("proxy.type", "Proxy type must be http, https, socks4, or socks5");
        }
    }

    private void ValidateUserAgent(JsonElement p, ValidationResult r)
    {
        if (!p.TryGetProperty("fingerprint", out var fp)) return;

        // Check if using custom mode - UserAgent is required
        var uaMode = fp.TryGetProperty("uaMode", out var uaModeEl)
            ? (uaModeEl.GetString() ?? "random").ToLowerInvariant()
            : "random";

        if (uaMode == "custom")
        {
            if (!fp.TryGetProperty("userAgent", out var ua) ||
                string.IsNullOrWhiteSpace(ua.GetString()))
            {
                r.WithError("userAgent", "User-Agent is required when using Custom mode");
            }
            else
            {
                var uaStr = ua.GetString()!;
                if (!uaStr.Contains("Chrome") && !uaStr.Contains("Firefox"))
                    r.WithError("userAgent", "User-Agent must contain Chrome or Firefox");
            }
        }
        // Real mode (useRealUserAgent=true) and Random mode (uaMode=random) are valid without UA
    }

    private static bool NormalizeBrowserType(string? input, out string normalized)
    {
        normalized = "";
        if (string.IsNullOrWhiteSpace(input)) return false;
        var lower = input.Trim().ToLowerInvariant();
        if (lower is "chromium" or "firefox") { normalized = char.ToUpperInvariant(lower[0]) + lower[1..]; return true; }
        return false;
    }
}
