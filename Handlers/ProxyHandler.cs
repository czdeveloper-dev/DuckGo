using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Handlers;

public class ProxyHandler
{
    private readonly ProxyService _proxyService;

    public ProxyHandler(ProxyService proxyService) => _proxyService = proxyService;

    public async Task<object> HandleAsync(string action, JsonElement? data)
    {
        return action switch
        {
            "proxy.list" => await HandleListAsync(),
            "proxy.create" => await HandleCreateAsync(data),
            "proxy.update" => await HandleUpdateAsync(data),
            "proxy.delete" => await HandleDeleteAsync(data),
            "proxy.check" => await HandleCheckAsync(data),
            _ => ApiResponse.Fail($"Unknown action: {action}")
        };
    }

    private async Task<object> HandleListAsync()
    {
        var result = await _proxyService.GetProxiesAsync();
        return ApiResponse<List<Models.Entities.Proxy>>.Ok(result);
    }

    private async Task<object> HandleCreateAsync(JsonElement? data)
    {
        if (!data.HasValue) return ApiResponse.Fail("Missing data");
        var req = JsonSerializer.Deserialize<ProxyCreateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            var id = await _proxyService.CreateProxyAsync(req);
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
        var req = JsonSerializer.Deserialize<ProxyUpdateRequest>(data.Value.GetRawText());
        if (req == null) return ApiResponse.Fail("Invalid data");

        try
        {
            await _proxyService.UpdateProxyAsync(req);
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
            await _proxyService.DeleteProxyAsync(idProp.GetInt32());
            return ApiResponse.Ok();
        }
        catch (Exception ex)
        {
            return ApiResponse.Fail(ex.Message);
        }
    }

    private async Task<object> HandleCheckAsync(JsonElement? data)
    {
        if (!data.HasValue || !data.Value.TryGetProperty("id", out var idProp))
            return ApiResponse.Fail("Missing id");

        var status = await _proxyService.CheckProxyAsync(idProp.GetInt32());
        return ApiResponse<object>.Ok(new { status });
    }
}
