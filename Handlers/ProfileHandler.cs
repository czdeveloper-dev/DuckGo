using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Handlers;

public class ProfileHandler
{
    private readonly ProfileService _profileService;

    public ProfileHandler(ProfileService profileService) => _profileService = profileService;

    public async Task<object> HandleAsync(string action, JsonElement? data)
    {
        return action switch
        {
            "profile.list" => await HandleListAsync(data),
            "profile.get" => await HandleGetAsync(data),
            "profile.create" => await HandleCreateAsync(data),
            "profile.update" => await HandleUpdateAsync(data),
            "profile.delete" => await HandleDeleteAsync(data),
            "profile.duplicate" => await HandleDuplicateAsync(data),
            _ => ApiResponse.Fail($"Unknown action: {action}")
        };
    }

    private async Task<object> HandleListAsync(JsonElement? data)
    {
        string? search = null, browserType = null;
        int? groupId = null;
        List<int>? tagIds = null;

        if (data.HasValue)
        {
            var d = data.Value;
            if (d.TryGetProperty("search", out var s)) search = s.GetString();
            if (d.TryGetProperty("groupId", out var g)) groupId = g.ValueKind == JsonValueKind.Null ? null : g.GetInt32();
            if (d.TryGetProperty("browserType", out var bt)) browserType = bt.ValueKind == JsonValueKind.Null ? null : bt.GetString();
        }

        var result = await _profileService.GetProfilesAsync(search, groupId, tagIds, browserType);
        return ApiResponse<ProfileListResponse>.Ok(result);
    }

    private async Task<object> HandleGetAsync(JsonElement? data)
    {
        if (!data.HasValue || !data.Value.TryGetProperty("id", out var idProp))
            return ApiResponse.Fail("Missing id");

        var profile = await _profileService.GetProfileAsync(idProp.GetInt32());
        if (profile == null) return ApiResponse.Fail("Profile not found");
        return ApiResponse<ProfileListItem>.Ok(profile);
    }

    private async Task<object> HandleCreateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<ProfileCreateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            var result = await _profileService.CreateProfileAsync(req);
            return ApiResponse<ProfileListItem>.Ok(result);
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleUpdateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<ProfileUpdateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            var result = await _profileService.UpdateProfileAsync(req);
            return ApiResponse<ProfileListItem>.Ok(result);
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleDeleteAsync(JsonElement? data)
    {
        if (!data.HasValue || !data.Value.TryGetProperty("id", out var idProp))
            return ApiResponse.Fail("Missing id");

        try
        {
            await _profileService.DeleteProfileAsync(idProp.GetInt32());
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleDuplicateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var d = data.Value;
        if (!d.TryGetProperty("id", out var idProp) || !d.TryGetProperty("name", out var nameProp))
            return ApiResponse.Fail("Missing id or name");

        try
        {
            var result = await _profileService.DuplicateProfileAsync(idProp.GetInt32(), nameProp.GetString() ?? "Copy");
            return ApiResponse<ProfileListItem>.Ok(result);
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }
}
