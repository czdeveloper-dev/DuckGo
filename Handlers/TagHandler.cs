using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Handlers;

public class TagHandler
{
    private readonly TagService _tagService;

    public TagHandler(TagService tagService) => _tagService = tagService;

    public async Task<object> HandleAsync(string action, JsonElement? data)
    {
        return action switch
        {
            "tag.list" => await HandleListAsync(),
            "tag.create" => await HandleCreateAsync(data),
            "tag.delete" => await HandleDeleteAsync(data),
            _ => ApiResponse.Fail($"Unknown action: {action}")
        };
    }

    private async Task<object> HandleListAsync()
    {
        var result = await _tagService.GetTagsAsync();
        return ApiResponse<List<Models.Entities.ProfileTag>>.Ok(result);
    }

    private async Task<object> HandleCreateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<TagCreateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            var id = await _tagService.CreateTagAsync(req);
            return ApiResponse<object>.Ok(new { id });
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
            await _tagService.DeleteTagAsync(idProp.GetInt32());
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }
}
