using System.Text.Json;

namespace DuckGo.Infrastructure.API;

public class ProfileDispatcher : IDispatcher
{
    private readonly Services.ProfileService _service;

    public string Domain => "profile";

    public ProfileDispatcher(Services.ProfileService service) => _service = service;

    public bool CanHandle(string action) => action.StartsWith("profile.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "profile.list" => await ListAsync(payload),
            "profile.get" => await GetAsync(payload),
            "profile.create" => await CreateAsync(payload),
            "profile.update" => await UpdateAsync(payload),
            "profile.delete" => await DeleteAsync(payload),
            "profile.duplicate" => await DuplicateAsync(payload),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync(JsonElement? payload)
    {
        string? search = null, browserType = null;
        int? groupId = null;

        if (payload.HasValue)
        {
            var p = payload.Value;
            if (p.TryGetProperty("search", out var s)) search = s.GetString();
            if (p.TryGetProperty("groupId", out var g)) groupId = g.ValueKind == JsonValueKind.Null ? null : g.GetInt32();
            if (p.TryGetProperty("browserType", out var b)) browserType = b.GetString();
        }

        var result = await _service.GetProfilesAsync(search, groupId, null, browserType);
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> GetAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);
        var profile = await _service.GetProfileAsync(id.Value);
        return profile != null ? (true, null, WrapInElement(profile)) : (false, "Profile not found", null);
    }

    private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.ProfileCreateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        var result = await _service.CreateProfileAsync(req);
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.ProfileUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        var result = await _service.UpdateProfileAsync(req);
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);
        await _service.DeleteProfileAsync(id.Value);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> DuplicateAsync(JsonElement? payload)
    {
        var id   = payload?.GetProperty("id").GetInt32();
        var name = payload?.GetProperty("name").GetString() ?? "Copy";
        if (!id.HasValue) return (false, "Missing id", null);
        var result = await _service.DuplicateProfileAsync(id.Value, name);
        return (true, null, WrapInElement(result));
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }

    private static T? ParsePayload<T>(JsonElement? payload) where T : class
    {
        if (!payload.HasValue) return null;
        try { return JsonSerializer.Deserialize<T>(payload.Value.GetRawText()); }
        catch { return null; }
    }
}
