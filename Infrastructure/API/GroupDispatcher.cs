using System.Text.Json;

namespace DuckGo.Infrastructure.API;

public class GroupDispatcher : IDispatcher
{
    private readonly Services.GroupService _service;

    public string Domain => "group";

    public GroupDispatcher(Services.GroupService service) => _service = service;

    public bool CanHandle(string action) => action.StartsWith("group.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "group.list" => await ListAsync(),
            "group.create" => await CreateAsync(payload),
            "group.update" => await UpdateAsync(payload),
            "group.delete" => await DeleteAsync(payload),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync()
    {
        var result = await _service.GetGroupsAsync();
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
    {
        var name = payload?.GetProperty("name").GetString();
        if (string.IsNullOrWhiteSpace(name)) return (false, "Group name is required", null);
        var group = await _service.CreateGroupAsync(new Models.DTOs.GroupCreateRequest(name));
        return (true, null, WrapInElement(group));
    }

    private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
    {
        var req = ParsePayload<Models.DTOs.GroupUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);
        await _service.UpdateGroupAsync(req);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);
        await _service.DeleteGroupAsync(id.Value);
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
