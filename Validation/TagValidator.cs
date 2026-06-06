using System.Text.Json;

namespace DuckGo.Validation;

public class TagValidator : IValidator
{
    public string[] SupportedActions => new[] { "tag.create", "tag.update", "tag.delete", "tag.list" };

    public ValidationResult Validate(string action, JsonElement? payload)
    {
        return action switch
        {
            "tag.create" => ValidateCreate(payload),
            "tag.update" => ValidateUpdate(payload),
            "tag.delete" => ValidateDelete(payload),
            "tag.list"  => ValidationResult.Ok(),
            _          => ValidationResult.Ok()
        };
    }

    private ValidationResult ValidateCreate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("name", out var n) || string.IsNullOrWhiteSpace(n.GetString()))
            r.WithError("name", "Tag name is required");
        return r;
    }

    private ValidationResult ValidateUpdate(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid tag ID is required");
        if (!p.Value.TryGetProperty("name", out var n) || string.IsNullOrWhiteSpace(n.GetString()))
            r.WithError("name", "Tag name is required");
        return r;
    }

    private ValidationResult ValidateDelete(JsonElement? p)
    {
        var r = ValidationResult.Ok();
        if (!p.HasValue) return r.WithError("payload", "Request body is required");
        if (!p.Value.TryGetProperty("id", out var id) || id.GetInt32() <= 0)
            r.WithError("id", "Valid tag ID is required");
        return r;
    }
}
