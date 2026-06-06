using System.Text.Json;
using DuckGo.Data.Repositories;

namespace DuckGo.Infrastructure.API;

public class ProxyTypeDispatcher : IDispatcher
{
    private readonly IProxyTypeRepository _repo;

    public string Domain => "proxyType";

    public ProxyTypeDispatcher(IProxyTypeRepository repo) => _repo = repo;

    public bool CanHandle(string action) => action.StartsWith("proxyType.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "proxyType.list" => await ListAsync(),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync()
    {
        var result = await _repo.GetAllAsync();
        return (true, null, WrapInElement(result));
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }
}
