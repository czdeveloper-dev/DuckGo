using System.Text.Json;

namespace DuckGo.Validation;

public class ProfileGroupValidator : IValidator
{
    public string[] SupportedActions => new[] { "group.create", "group.update", "group.delete", "group.list" };

    public ValidationResult Validate(string action, JsonElement? payload)
    {
        return action switch
        {
            "group.create" => ValidateCreate(payload),
            "group.update" => ValidateUpdate(payload),
            "group.delete" => ValidateDelete(payload),
            "group.list"  => ValidationResult.Ok(),
            _             => ValidationResult.Ok()
        };
    }

    private ValidationResult ValidateCreate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("name", out var n) || string.IsNullOrWhiteSpace(n.GetString()))
            r.WithError("name", "Group name is required");
        return r;
    }

    private ValidationResult ValidateUpdate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid group ID is required");
        if (!p.Value.TryGetProperty("name", out var n) || string.IsNullOrWhiteSpace(n.GetString()))
            r.WithError("name", "Group name is required");
        return r;
    }

    private ValidationResult ValidateDelete(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid group ID is required");
        return r;
    }
}
