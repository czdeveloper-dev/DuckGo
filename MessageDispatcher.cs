using System.Text.Json;
using DuckGo.Models.DTOs;

namespace DuckGo;

/// <summary>
/// Unified message dispatcher — single entry point for all JS ↔ C# communication.
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
    private readonly Services.ProfileService  _profileService;
    private readonly Services.GroupService   _groupService;
    private readonly Services.TagService     _tagService;
    private readonly Services.ProxyService   _proxyService;

    public MessageDispatcher(
        Services.ProfileService  profileService,
        Services.GroupService    groupService,
        Services.TagService     tagService,
        Services.ProxyService    proxyService)
    {
        _profileService = profileService;
        _groupService   = groupService;
        _tagService     = tagService;
        _proxyService   = proxyService;
    }

    /// <summary>Parse a raw JSON request and return a JSON response string.</summary>
    public async Task<string> DispatchAsync(string json)
    {
        int id = 0;
        string action = "";
        JsonElement? payload = null;

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("id",      out var idProp))      id      = idProp.GetInt32();
            if (root.TryGetProperty("action",   out var actProp))     action  = actProp.GetString() ?? "";
            if (root.TryGetProperty("payload",  out var plProp))      payload = plProp;

            var (success, error, data) = await ExecuteActionAsync(action, payload);

            return JsonSerializer.Serialize(new ResponseEnvelope
            {
                Type    = "response",
                Id      = id,
                Success = success,
                Error   = error,
                Data    = data
            });
        }
        catch (JsonException ex)
        {
            return JsonSerializer.Serialize(new ResponseEnvelope
            {
                Type    = "response",
                Id      = id,
                Success = false,
                Error   = $"Invalid JSON: {ex.Message}"
            });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new ResponseEnvelope
            {
                Type    = "response",
                Id      = id,
                Success = false,
                Error   = ex.Message
            });
        }
    }

    private async Task<(bool Success, string? Error, object? Data)> ExecuteActionAsync(
        string action, JsonElement? payload)
    {
        // ── GROUP ──────────────────────────────────────────────────────────
        if (action == "group.list")
        {
            var groups = await _groupService.GetGroupsAsync();
            return (true, null, groups);
        }

        if (action == "group.create")
        {
            var name = payload?.GetProperty("name").GetString();
            if (string.IsNullOrWhiteSpace(name))
                return (false, "Group name is required", null);
            var id = await _groupService.CreateGroupAsync(new GroupCreateRequest(name));
            return (true, null, new { id });
        }

        if (action == "group.update")
        {
            var req = ParsePayload<GroupUpdateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            await _groupService.UpdateGroupAsync(req);
            return (true, null, null);
        }

        if (action == "group.delete")
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            await _groupService.DeleteGroupAsync(id.Value);
            return (true, null, null);
        }

        // ── TAG ───────────────────────────────────────────────────────────
        if (action == "tag.list")
        {
            var tags = await _tagService.GetTagsAsync();
            return (true, null, tags);
        }

        if (action == "tag.create")
        {
            var name = payload?.GetProperty("name").GetString();
            if (string.IsNullOrWhiteSpace(name))
                return (false, "Tag name is required", null);
            var id = await _tagService.CreateTagAsync(new TagCreateRequest(name));
            return (true, null, new { id });
        }

        if (action == "tag.delete")
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            await _tagService.DeleteTagAsync(id.Value);
            return (true, null, null);
        }

        // ── PROFILE ───────────────────────────────────────────────────────
        if (action == "profile.list")
        {
            string? search      = null;
            int?    groupId     = null;
            string? browserType = null;

            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("search",      out var s)) search      = s.GetString();
                if (p.TryGetProperty("groupId",     out var g)) groupId     = g.ValueKind == JsonValueKind.Null ? null : g.GetInt32();
                if (p.TryGetProperty("browserType", out var b)) browserType = b.GetString();
            }

            var result = await _profileService.GetProfilesAsync(search, groupId, null, browserType);
            return (true, null, result);
        }

        if (action == "profile.get")
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            var profile = await _profileService.GetProfileAsync(id.Value);
            return profile != null ? (true, null, (object?)profile) : (false, "Profile not found", null);
        }

        if (action == "profile.create")
        {
            var req = ParsePayload<ProfileCreateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result = await _profileService.CreateProfileAsync(req);
            return (true, null, result);
        }

        if (action == "profile.update")
        {
            var req = ParsePayload<ProfileUpdateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result = await _profileService.UpdateProfileAsync(req);
            return (true, null, result);
        }

        if (action == "profile.delete")
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            await _profileService.DeleteProfileAsync(id.Value);
            return (true, null, null);
        }

        if (action == "profile.duplicate")
        {
            var id   = payload?.GetProperty("id").GetInt32();
            var name = payload?.GetProperty("name").GetString() ?? "Copy";
            if (!id.HasValue) return (false, "Missing id", null);
            var result = await _profileService.DuplicateProfileAsync(id.Value, name);
            return (true, null, result);
        }

        // ── PROXY ────────────────────────────────────────────────────────
        if (action == "proxy.list")
        {
            var proxies = await _proxyService.GetProxiesAsync();
            return (true, null, proxies);
        }

        if (action == "proxy.create")
        {
            var req = ParsePayload<ProxyCreateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var id = await _proxyService.CreateProxyAsync(req);
            return (true, null, new { id });
        }

        if (action == "proxy.update")
        {
            var req = ParsePayload<ProxyUpdateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            await _proxyService.UpdateProxyAsync(req);
            return (true, null, null);
        }

        if (action == "proxy.delete")
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            await _proxyService.DeleteProxyAsync(id.Value);
            return (true, null, null);
        }

        return (false, $"Unknown action: {action}", null);
    }

    private static T? ParsePayload<T>(JsonElement? payload) where T : class
    {
        if (!payload.HasValue) return null;
        try
        {
            return JsonSerializer.Deserialize<T>(payload.Value.GetRawText());
        }
        catch { return null; }
    }

    // ── Envelope types ─────────────────────────────────────────────────

    private class ResponseEnvelope
    {
        public string  Type    { get; set; } = "response";
        public int     Id      { get; set; }
        public bool    Success { get; set; }
        public string? Error   { get; set; }
        public object? Data    { get; set; }
    }
}
