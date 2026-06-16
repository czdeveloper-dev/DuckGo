using System.Collections.Generic;
using System.Text.Json;
using DuckGo.Models.DTOs;
using DuckGo.Services;

namespace DuckGo.Infrastructure.API;

public class ProxyDispatcher : IDispatcher
{
    private readonly Services.ProxyService _service;

    public string Domain => "proxy";

    public ProxyDispatcher(Services.ProxyService service) => _service = service;

    public bool CanHandle(string action) => action.StartsWith("proxy.") || action.StartsWith("proxygroup.") || action.StartsWith("proxytag.");

    public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
    {
        return action switch
        {
            "proxy.list" => await ListAsync(payload),
            "proxy.create" => await CreateAsync(payload),
            "proxy.createBulk" => await CreateBulkAsync(payload),
            "proxy.update" => await UpdateAsync(payload),
            "proxy.delete" => await DeleteAsync(payload),
            "proxy.check" => await CheckAsync(payload),
            "proxy.checkDeep" => await CheckDeepAsync(payload),
            "proxy.scan" => await ScanAsync(payload),
            "proxy.scanQuick" => await ScanQuickAsync(payload),
            "proxy.scanAndImport" => await ScanAndImportAsync(payload),
            "proxy.cancelScan" => await CancelScanAsync(payload),
            "proxy.updateName" => await UpdateNameAsync(payload),
            "proxy.updateNotes" => await UpdateNotesAsync(payload),
            "proxygroup.list" => await ListGroupsAsync(),
            "proxygroup.create" => await CreateGroupAsync(payload),
            "proxygroup.update" => await UpdateGroupAsync(payload),
            "proxygroup.delete" => await DeleteGroupAsync(payload),
            "proxygroup.deleteWithProxies" => await DeleteGroupWithProxiesAsync(payload),
            "proxytag.list" => await ListTagsAsync(),
            "proxytag.create" => await CreateTagAsync(payload),
            "proxytag.update" => await UpdateTagAsync(payload),
            "proxytag.delete" => await DeleteTagAsync(payload),
            "proxy.export" => await ExportAsync(payload),
            "proxy.copyFormat" => await CopyFormatAsync(payload),
            "proxy.checkProxies" => await CheckProxiesAsync(payload),
            "proxy.parseFile" => await ParseFileAsync(payload),
            _ => (false, $"Unknown action: {action}", null)
        };
    }

    private async Task<(bool, string?, JsonElement?)> ListAsync(JsonElement? payload)
    {
        string? search = null, idStr = null, status = null;
        int? groupId = null;
        List<int>? tagIds = null;

        if (payload.HasValue)
        {
            if (payload.Value.TryGetProperty("search", out var searchProp) && searchProp.ValueKind == JsonValueKind.String)
                search = searchProp.GetString();
            if (payload.Value.TryGetProperty("idStr", out var idProp) && idProp.ValueKind == JsonValueKind.String)
                idStr = idProp.GetString();
            if (payload.Value.TryGetProperty("groupId", out var gidProp) && gidProp.ValueKind != JsonValueKind.Null)
                groupId = gidProp.GetInt32();
            if (payload.Value.TryGetProperty("tagIds", out var tidsProp) && tidsProp.ValueKind == JsonValueKind.Array)
                tagIds = tidsProp.EnumerateArray().Select(x => x.GetInt32()).ToList();
            if (payload.Value.TryGetProperty("status", out var stProp) && stProp.ValueKind != JsonValueKind.Null)
                status = stProp.GetString();
        }

        var result = await _service.GetProxiesAsync(search, idStr, groupId, tagIds, status);
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
    {
        var req = ParsePayload<ProxyCreateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);

        try
        {
            var proxyId = await _service.CreateProxyAsync(req);
            var proxy = await _service.GetProxyAsync(proxyId);
            return (true, null, WrapInElement(proxy));
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> CreateBulkAsync(JsonElement? payload)
    {
        var req = ParsePayload<ProxyBulkCreateRequest>(payload);
        if (req == null || req.Proxies == null || req.Proxies.Count == 0)
            return (false, "Invalid payload", null);

        try
        {
            var result = await _service.CreateBulkProxiesAsync(req.Proxies);
            return (true, null, WrapInElement(result));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
    {
        var req = ParsePayload<ProxyUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);

        try
        {
            await _service.UpdateProxyAsync(req);
            return (true, null, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                var ids = idsProp.EnumerateArray().Select(x => x.GetInt32()).ToList();
                await _service.BulkDeleteAsync(ids);
                return (true, null, null);
            }
            if (payload.Value.TryGetProperty("id", out var idProp) && idProp.ValueKind != JsonValueKind.Null)
            {
                await _service.DeleteProxyAsync(idProp.GetInt32());
                return (true, null, null);
            }
            return (false, "Missing id or ids", null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> CheckAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            if (payload.Value.TryGetProperty("id", out var idProp) && idProp.ValueKind != JsonValueKind.Null)
            {
                var result = await _service.CheckProxyAsync(idProp.GetInt32());
                return (true, null, WrapInElement(result));
            }

            var req = ParsePayload<ProxyCheckRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result2 = await _service.CheckProxyAsync(req);
            return (true, null, WrapInElement(result2));
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }
    
    // Deep check with longer timeout and HTTP validation
    private async Task<(bool, string?, JsonElement?)> CheckDeepAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            if (payload.Value.TryGetProperty("id", out var idProp) && idProp.ValueKind != JsonValueKind.Null)
            {
                var result = await _service.CheckProxyDeepAsync(idProp.GetInt32());
                return (true, null, WrapInElement(result));
            }

            var req = ParsePayload<ProxyCheckRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result2 = await _service.CheckProxyDeepAsync(req);
            return (true, null, WrapInElement(result2));
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> ScanAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var ids = new List<int>();
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }

            if (ids.Count == 0)
                return (false, "No proxy IDs provided", null);

            var maxThreads = 50;
            if (payload.Value.TryGetProperty("maxThreads", out var mtProp) && mtProp.ValueKind == JsonValueKind.Number)
                maxThreads = mtProp.GetInt32();

            // Get scanId if provided (for cancellation)
            string? scanId = null;
            if (payload.Value.TryGetProperty("scanId", out var scanIdProp) && scanIdProp.ValueKind == JsonValueKind.String)
            {
                scanId = scanIdProp.GetString();
            }

            // Register scan with manager if scanId provided
            if (!string.IsNullOrEmpty(scanId))
            {
                ProxyScanManager.StartScan(scanId);
            }

            try
            {
                var results = await _service.ScanProxiesParallelAsync(ids, maxThreads);
                return (true, null, WrapInElement(results));
            }
            finally
            {
                // Clean up scan
                if (!string.IsNullOrEmpty(scanId))
                {
                    ProxyScanManager.RemoveScan(scanId);
                }
            }
        }
        catch (OperationCanceledException)
        {
            return (false, "Scan cancelled", null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }
    
    // Quick scan that runs in background and returns immediately
    // Frontend polls proxy.list to get updated statuses
    private async Task<(bool, string?, JsonElement?)> ScanQuickAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var ids = new List<int>();
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }

            if (ids.Count == 0)
                return (false, "No proxy IDs provided", null);

            var maxThreads = 50;
            if (payload.Value.TryGetProperty("maxThreads", out var mtProp) && mtProp.ValueKind == JsonValueKind.Number)
                maxThreads = mtProp.GetInt32();

            string? scanId = null;
            if (payload.Value.TryGetProperty("scanId", out var scanIdProp) && scanIdProp.ValueKind == JsonValueKind.String)
            {
                scanId = scanIdProp.GetString();
            }

            // Register scan for cancellation
            if (!string.IsNullOrEmpty(scanId))
            {
                ProxyScanManager.StartScan(scanId);
            }

            // Run scan in background - fire and forget
            _ = Task.Run(async () =>
            {
                try
                {
                    await _service.ScanProxiesParallelAsync(ids, maxThreads);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[ProxyScanner] Background scan error: {ex.Message}");
                }
                finally
                {
                    if (!string.IsNullOrEmpty(scanId))
                    {
                        ProxyScanManager.RemoveScan(scanId);
                    }
                }
            });

            // Return immediately with accepted status
            return (true, null, WrapInElement(new { Accepted = true, TotalCount = ids.Count }));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }
    
    private async Task<(bool, string?, JsonElement?)> CancelScanAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            string? scanId = null;
            if (payload.Value.TryGetProperty("scanId", out var scanIdProp) && scanIdProp.ValueKind == JsonValueKind.String)
            {
                scanId = scanIdProp.GetString();
            }

            if (string.IsNullOrEmpty(scanId))
                return (false, "Missing scanId", null);

            ProxyScanManager.CancelScan(scanId);
            return (true, null, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }
    
    // Deep scan and import - scans proxies then creates only alive ones
    private async Task<(bool, string?, JsonElement?)> ScanAndImportAsync(JsonElement? payload)
    {
        Console.WriteLine("========================================");
        Console.WriteLine("[ScanAndImport] STARTING NOW...");
        Console.WriteLine($"[ScanAndImport] Payload hasValue: {payload.HasValue}");
        if (payload.HasValue)
        {
            Console.WriteLine($"[ScanAndImport] Payload: {payload.Value.GetRawText()}");
        }
        
        if (!payload.HasValue)
        {
            Console.WriteLine("[ScanAndImport] No payload - returning error");
            return (false, "Missing payload", null);
        }

        try
        {
            // Parse proxy strings
            var proxyStrings = new List<string>();
            if (payload.Value.TryGetProperty("proxies", out var proxiesProp) && proxiesProp.ValueKind == JsonValueKind.Array)
            {
                Console.WriteLine($"[ScanAndImport] Found proxies array with {proxiesProp.GetArrayLength()} items");
                foreach (var item in proxiesProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                        proxyStrings.Add(item.GetString()!);
                }
            }
            else
            {
                Console.WriteLine("[ScanAndImport] No 'proxies' array in payload");
            }

            Console.WriteLine($"[ScanAndImport] Parsed {proxyStrings.Count} proxy strings");

            if (proxyStrings.Count == 0)
            {
                Console.WriteLine("[ScanAndImport] No proxies - returning error");
                return (false, "No proxies provided", null);
            }

            Console.WriteLine($"[ScanAndImport] Calling CreateBulkProxiesAsync with {proxyStrings.Count} proxies...");
            
            // Import directly without scanning
            var createResult = await _service.CreateBulkProxiesAsync(proxyStrings);
            
            Console.WriteLine($"[ScanAndImport] CreateBulkProxiesAsync returned: Success={createResult?.Success}, Imported={createResult?.Imported}");
            if (createResult?.Errors?.Count > 0)
            {
                foreach (var err in createResult.Errors)
                {
                    Console.WriteLine($"[ScanAndImport] Error: {err}");
                }
            }

            var imported = createResult?.Imported ?? 0;

            Console.WriteLine($"[ScanAndImport] DONE - returning success with {imported} imported");

            return (true, null, WrapInElement(new { 
                Total = proxyStrings.Count, 
                Alive = imported, 
                Dead = proxyStrings.Count - imported, 
                Imported = imported 
            }));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ScanAndImport] EXCEPTION: {ex}");
            return (false, ex.Message, null);
        }
    }
    
    // Helper to parse proxy string
    private (string Host, int Port, string? Type, string? Username, string? Password)? ParseProxyString(string proxyStr)
    {
        try
        {
            string type = "http";
            string host;
            int port;
            string? username = null;
            string? password = null;

            var s = proxyStr.Trim();
            
            // Check for type prefix
            var typeMatch = System.Text.RegularExpressions.Regex.Match(s, @"^(http|https|socks4|socks5)://", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (typeMatch.Success)
            {
                type = typeMatch.Groups[1].Value.ToLower();
                s = s.Substring(typeMatch.Length);
                
                // Check for auth in URL format
                var atIndex = s.IndexOf('@');
                if (atIndex > -1)
                {
                    var auth = s.Substring(0, atIndex).Split(':');
                    username = auth[0];
                    if (auth.Length > 1) password = auth[1];
                    s = s.Substring(atIndex + 1);
                }
            }
            
            // Split by : to get host and port
            var lastColon = s.LastIndexOf(':');
            if (lastColon > -1)
            {
                host = s.Substring(0, lastColon);
                if (int.TryParse(s.Substring(lastColon + 1), out port))
                {
                    // Check for user:pass format (host:port:user:pass)
                    if (string.IsNullOrEmpty(username) && s.Contains(':'))
                    {
                        var parts = s.Split(':');
                        if (parts.Length >= 4)
                        {
                            // host:port:user:pass format - reparse
                            return null;
                        }
                    }
                    return (host, port, type, username, password);
                }
            }
            return null;
        }
        catch
        {
            return null;
        }
    }

    private async Task<(bool, string?, JsonElement?)> UpdateNameAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var id = payload.Value.GetProperty("id").GetInt32();
            var name = payload.Value.GetProperty("name").GetString();
            await _service.UpdateProxyNameAsync(id, name ?? "");
            return (true, null, null);
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> UpdateNotesAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var id = payload.Value.GetProperty("id").GetInt32();
            var notes = payload.Value.TryGetProperty("notes", out var n) ? n.GetString() : "";
            await _service.UpdateProxyNotesAsync(id, notes ?? "");
            return (true, null, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    // Proxy Group handlers
    private async Task<(bool, string?, JsonElement?)> ListGroupsAsync()
    {
        var result = await _service.GetGroupsAsync();
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateGroupAsync(JsonElement? payload)
    {
        var name = payload?.GetProperty("name").GetString();
        if (string.IsNullOrWhiteSpace(name)) return (false, "Group name is required", null);

        try
        {
            var group = await _service.CreateGroupAsync(new ProxyGroupCreateRequest(name));
            return (true, null, WrapInElement(group));
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> UpdateGroupAsync(JsonElement? payload)
    {
        var req = ParsePayload<ProxyGroupUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);

        try
        {
            await _service.UpdateGroupAsync(req);
            return (true, null, null);
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> DeleteGroupAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);

        await _service.DeleteGroupAsync(id.Value);
        return (true, null, null);
    }

    private async Task<(bool, string?, JsonElement?)> DeleteGroupWithProxiesAsync(JsonElement? payload)
    {
        var id = payload?.GetProperty("id").GetInt32();
        if (!id.HasValue) return (false, "Missing id", null);

        await _service.DeleteGroupWithProxiesAsync(id.Value);
        return (true, null, null);
    }

    // Proxy Tag handlers
    private async Task<(bool, string?, JsonElement?)> ListTagsAsync()
    {
        var result = await _service.GetTagsAsync();
        return (true, null, WrapInElement(result));
    }

    private async Task<(bool, string?, JsonElement?)> CreateTagAsync(JsonElement? payload)
    {
        var name = payload?.GetProperty("name").GetString();
        if (string.IsNullOrWhiteSpace(name)) return (false, "Tag name is required", null);

        try
        {
            var tag = await _service.CreateTagAsync(new ProxyTagCreateRequest(name));
            return (true, null, WrapInElement(tag));
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> UpdateTagAsync(JsonElement? payload)
    {
        var req = ParsePayload<ProxyTagUpdateRequest>(payload);
        if (req == null) return (false, "Invalid payload", null);

        try
        {
            await _service.UpdateTagAsync(req);
            return (true, null, null);
        }
        catch (ArgumentException ex)
        {
            return (false, ex.Message, null);
        }
        catch (InvalidOperationException ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> DeleteTagAsync(JsonElement? payload)
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

    private async Task<(bool, string?, JsonElement?)> ExportAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var ids = new List<int>();
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }

            var format = "default";
            if (payload.Value.TryGetProperty("format", out var fmtProp) && fmtProp.ValueKind == JsonValueKind.String)
                format = fmtProp.GetString() ?? "default";

            // Check if client wants content only (for save dialog)
            var contentOnly = false;
            if (payload.Value.TryGetProperty("contentOnly", out var coProp) && coProp.ValueKind == JsonValueKind.True)
                contentOnly = true;

            if (contentOnly)
            {
                // Return content for client to handle via save dialog
                var content = await _service.CopyProxiesAsFormatAsync(ids, format);
                var ext = format.ToLower() switch {
                    "csv" => "csv",
                    "json" => "json",
                    _ => "txt"
                };
                return (true, null, WrapInElement(new { 
                    content,
                    format,
                    suggestedName = $"proxies_export.{ext}"
                }));
            }
            else
            {
                // Legacy: export to temp file
                var filePath = await _service.ExportProxiesAsync(ids, format);
                return (true, null, WrapInElement(new { filePath }));
            }
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> CopyFormatAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var ids = new List<int>();
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }

            var format = "default";
            if (payload.Value.TryGetProperty("format", out var fmtProp) && fmtProp.ValueKind == JsonValueKind.String)
                format = fmtProp.GetString() ?? "default";

            var content = await _service.CopyProxiesAsFormatAsync(ids, format);
            return (true, null, WrapInElement(new { content }));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> CheckProxiesAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var ids = new List<int>();
            if (payload.Value.TryGetProperty("ids", out var idsProp) && idsProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in idsProp.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }

            if (ids.Count == 0)
                return (false, "No proxy IDs provided", null);

            var results = await _service.CheckProxiesAsync(ids);
            return (true, null, WrapInElement(results));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    private async Task<(bool, string?, JsonElement?)> ParseFileAsync(JsonElement? payload)
    {
        if (!payload.HasValue) return (false, "Missing payload", null);

        try
        {
            var content = "";
            
            // Check for content (sent from frontend)
            if (payload.Value.TryGetProperty("content", out var contentProp) && contentProp.ValueKind == JsonValueKind.String)
                content = contentProp.GetString() ?? "";
            
            // Check for filePath (direct file path from native context)
            var filePath = "";
            if (payload.Value.TryGetProperty("filePath", out var fpProp) && fpProp.ValueKind == JsonValueKind.String)
                filePath = fpProp.GetString() ?? "";

            if (string.IsNullOrEmpty(content) && string.IsNullOrEmpty(filePath))
                return (false, "Missing content or filePath", null);

            if (!string.IsNullOrEmpty(filePath))
            {
                if (!System.IO.File.Exists(filePath))
                    return (false, "File not found", null);
                content = await System.IO.File.ReadAllTextAsync(filePath);
            }

            var items = await _service.ParseProxiesFromContentAsync(content);

            return (true, null, WrapInElement(new { 
                proxies = items,
                total = items.Count
            }));
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }
}
