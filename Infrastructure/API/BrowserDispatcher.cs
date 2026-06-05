using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class BrowserDispatcher : IDispatcher
{
    private readonly BrowserVersionService _service;

    public BrowserDispatcher(BrowserVersionService service)
    {
        _service = service;
    }

    public string Domain => "browser";

    public bool CanHandle(string action) => action == "browser.listVersions";

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        try
        {
            var catalog = await _service.GetBrowserCatalogAsync();
            return (true, null, WrapInElement(catalog));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private static JsonElement WrapInElement<T>(T obj)
    {
        var json = JsonSerializer.Serialize(obj);
        return JsonDocument.Parse(json).RootElement;
    }
}
