using System.Text.Json;
using System.Diagnostics;

namespace DuckGo.Infrastructure.API;

public class TagDispatcher : IDispatcher
{
    private readonly Services.TagService _service;

    public string Domain => "tag";

    public TagDispatcher(Services.TagService service) => _service = service;

    public bool CanHandle(string action) => action.StartsWith("tag.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "tag.list" => await ListAsync(),
            "tag.create" => await CreateAsync(payload),
            "tag.update" => await UpdateAsync(payload),
            "tag.delete" => await DeleteAsync(payload),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync()
    {
        Debug.WriteLine($"[TagDispatcher] ListAsync called");
        var result = await _service.GetTagsAsync();
        Debug.WriteLine($"[TagDispatcher] ListAsync result count: {result.Count}");
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
    {
        var name = payload?.GetProperty("name").GetString();
        if (string.IsNullOrWhiteSpace(name)) return (false, "Tag name is required", null);
        var tag = await _service.CreateTagAsync(new Models.DTOs.TagCreateRequest(name));
        return (true, null, WrapInElement(tag));
    }

    private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.TagUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        await _service.UpdateTagAsync(req);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);
        await _service.DeleteTagAsync(id.Value);
        return (true, null, null);
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }

    private static T? ParsePayload<T>(JsonElement? payload) where T : class
    {
        if (!payload.HasValue) return null;
        try
        {
            return JsonSerializer.Deserialize<T>(payload.Value.GetRawText(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { return null; }
    }
}
