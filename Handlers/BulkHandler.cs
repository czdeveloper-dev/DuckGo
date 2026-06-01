using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Handlers;

public class BulkHandler
{
    private readonly ProfileService _profileService;

    public BulkHandler(ProfileService profileService) => _profileService = profileService;

    public async Task<object> HandleAsync(string action, JsonElement? data)
    {
        return action switch
        {
            "bulk.delete" => await HandleDeleteAsync(data),
            "bulk.assignGroup" => await HandleAssignGroupAsync(data),
            _ => ApiResponse.Fail($"Unknown action: {action}")
        };
    }

    private async Task<object> HandleDeleteAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<BulkDeleteRequest>(data.Value.GetRawText());
        if (req == null || req.Ids.Count == 0) return ApiResponse.Fail("Invalid ids");

        try
        {
            await _profileService.BulkDeleteAsync(req.Ids);
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleAssignGroupAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<BulkAssignGroupRequest>(data.Value.GetRawText());
        if (req == null || req.Ids.Count == 0) return ApiResponse.Fail("Invalid ids");

        try
        {
            await _profileService.BulkAssignGroupAsync(req.Ids, req.GroupId);
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }
}
