using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Handlers;

public class GroupHandler
{
    private readonly GroupService _groupService;

    public GroupHandler(GroupService groupService) => _groupService = groupService;

    public async Task<object> HandleAsync(string action, JsonElement? data)
    {
        return action switch
        {
            "group.list" => await HandleListAsync(),
            "group.create" => await HandleCreateAsync(data),
            "group.update" => await HandleUpdateAsync(data),
            "group.delete" => await HandleDeleteAsync(data),
            _ => ApiResponse.Fail($"Unknown action: {action}")
        };
    }

    private async Task<object> HandleListAsync()
    {
        var result = await _groupService.GetGroupsAsync();
        return ApiResponse<List<Models.Entities.ProfileGroup>>.Ok(result);
    }

    private async Task<object> HandleCreateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<GroupCreateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            var id = await _groupService.CreateGroupAsync(req);
            return ApiResponse<object>.Ok(new { id });
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleUpdateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<GroupUpdateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            await _groupService.UpdateGroupAsync(req);
            return ApiResponse.Ok();
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
            await _groupService.DeleteGroupAsync(idProp.GetInt32());
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }
}
