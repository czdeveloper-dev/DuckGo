using System.Text.Json;

namespace DuckGo.Infrastructure.API;

public interface IDispatcher
{
    string Domain { get; }
    bool CanHandle(string action);
    Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload);
}
