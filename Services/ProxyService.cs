using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bogus;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

// Scan manager for tracking active scans
public class ProxyScanManager
{
    private static readonly Dictionary<string, bool> _activeScans = new();
    private static readonly object _lock = new();

    public static void StartScan(string scanId)
    {
        lock (_lock)
        {
            _activeScans[scanId] = true;
            Console.WriteLine($"[ProxyScanManager] Started scan: {scanId}");
        }
    }

    public static void CancelScan(string scanId)
    {
        lock (_lock)
        {
            if (_activeScans.ContainsKey(scanId))
            {
                _activeScans[scanId] = false;
                Console.WriteLine($"[ProxyScanManager] Cancelled scan: {scanId}");
            }
        }
    }

    public static bool IsScanActive(string scanId)
    {
        lock (_lock)
        {
            return _activeScans.TryGetValue(scanId, out var active) && active;
        }
    }

    public static void RemoveScan(string scanId)
    {
        lock (_lock)
        {
            _activeScans.Remove(scanId);
            Console.WriteLine($"[ProxyScanManager] Removed scan: {scanId}");
        }
    }
}

public class ProxyService
{
    private readonly IProxyRepository _repo;
    private readonly IProfileGroupRepository _groupRepo;
    private readonly IProfileTagRepository _tagRepo;
    private readonly IProxyTypeRepository _typeRepo;

    public ProxyService(
        IProxyRepository repo,
        IProfileGroupRepository groupRepo,
        IProfileTagRepository tagRepo,
        IProxyTypeRepository typeRepo)
    {
        _repo = repo;
        _groupRepo = groupRepo;
        _tagRepo = tagRepo;
        _typeRepo = typeRepo;
    }

    private static string GenerateRandomName()
    {
        var faker = new Faker();
        var firstName = faker.Name.FirstName();
        var lastName = faker.Name.LastName();
        var suffix = faker.Random.Number(10, 9999);
        return $"{firstName} {lastName} {suffix}";
    }

    public async Task<ProxyListResponse> GetProxiesAsync(
        string? search = null,
        string? idStr = null,
        int? groupId = null,
        List<int>? tagIds = null,
        string? status = null)
    {
        var proxies = await _repo.GetAllAsync(search, idStr, groupId, tagIds);

        // Get all tags to map TagIds -> TagNames
        var allTags = await _tagRepo.GetAllAsync();
        var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);

        // Get all proxy types to resolve TypeId -> Type value
        var allTypes = await _typeRepo.GetAllAsync();
        var typeDict = allTypes.ToDictionary(t => t.Id, t => t.Value);

        var items = proxies.Select(p =>
        {
            // Parse TagIds from JSON
            List<int> pTagIds;
            try { pTagIds = JsonSerializer.Deserialize<List<int>>(p.Tags) ?? new(); }
            catch { pTagIds = new(); }

            // Resolve type from TypeId
            var typeValue = p.TypeId.HasValue && typeDict.TryGetValue(p.TypeId.Value, out var tv)
                ? tv
                : "http";

            // Map TagIds -> TagNames
            var tagNames = pTagIds.Select(id => tagDict.GetValueOrDefault(id, "")).Where(n => n != "").ToList();

            // Get runtime status from ProxyStatusService
            var runtimeStatus = ProxyStatusService.GetStatus(p.Id);
            var runtimeMessage = ProxyStatusService.GetMessage(p.Id);
            var runtimeLatency = ProxyStatusService.GetLatency(p.Id);

            // Filter by status if specified
            if (!string.IsNullOrEmpty(status))
            {
                // null runtimeStatus means "not_checked"
                var runtimeStatusOrDefault = runtimeStatus?.ToLowerInvariant() ?? "not_checked";
                if (runtimeStatusOrDefault != status.ToLowerInvariant())
                    return null;
            }

            return new ProxyListItem(
                Id: p.Id,
                Name: p.Name,
                Type: typeValue,
                GroupId: p.GroupId,
                GroupName: p.GroupName,
                TagIds: pTagIds,
                TagNames: tagNames,
                Host: p.Host,
                Port: p.Port,
                Username: p.Username,
                Password: p.Password,
                RotaryApi: p.RotaryApi,
                Notes: p.Notes,
                Status: runtimeStatus ?? "not_checked",
                Message: runtimeMessage,
                LatencyMs: runtimeLatency,
                CreatedAt: p.CreatedAt
            );
        }).Where(x => x != null).Cast<ProxyListItem>().ToList();

        return new ProxyListResponse(Total: items.Count, Items: items);
    }

    public async Task<Proxy?> GetProxyAsync(int id)
        => await _repo.GetByIdAsync(id);

    public async Task<int> CreateProxyAsync(ProxyCreateRequest req)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(req.Host))
            throw new ArgumentException("Host is required");

        if (req.Port <= 0)
            throw new ArgumentException("Port must be greater than 0");

        // Resolve TypeId from type value
        int? typeId = null;
        if (!string.IsNullOrWhiteSpace(req.Type))
        {
            var proxyType = await _typeRepo.GetByValueAsync(req.Type);
            typeId = proxyType?.Id;
        }

        var proxy = new Proxy
        {
            Name = string.IsNullOrWhiteSpace(req.Name) ? GenerateRandomName() : req.Name.Trim(),
            TypeId = typeId,
            GroupId = req.GroupId,
            Tags = JsonSerializer.Serialize(req.TagIds ?? new List<int>()),
            Host = req.Host.Trim(),
            Port = req.Port,
            Username = req.Username ?? "",
            Password = req.Password ?? "",
            RotaryApi = req.RotaryApi ?? "",
            Notes = req.Notes ?? "",
            CreatedAt = DateTime.Now
        };
        return await _repo.CreateAsync(proxy);
    }

    public async Task UpdateProxyAsync(ProxyUpdateRequest req)
    {
        var existing = await _repo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Proxy {req.Id} not found");

        if (!string.IsNullOrWhiteSpace(req.Name))
            existing.Name = req.Name.Trim();

        if (!string.IsNullOrWhiteSpace(req.Type))
        {
            var proxyType = await _typeRepo.GetByValueAsync(req.Type);
            existing.TypeId = proxyType?.Id;
        }

        if (req.GroupId.HasValue)
            existing.GroupId = req.GroupId;

        if (req.TagIds != null)
            existing.Tags = JsonSerializer.Serialize(req.TagIds);

        if (!string.IsNullOrWhiteSpace(req.Host))
            existing.Host = req.Host.Trim();

        if (req.Port.HasValue && req.Port > 0)
            existing.Port = req.Port.Value;

        if (req.Username != null)
            existing.Username = req.Username;

        if (req.Password != null)
            existing.Password = req.Password;

        if (req.RotaryApi != null)
            existing.RotaryApi = req.RotaryApi;

        if (req.Notes != null)
            existing.Notes = req.Notes;

        await _repo.UpdateAsync(existing);
    }

    public async Task UpdateProxyNameAsync(int id, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty");

        var existing = await _repo.GetByIdAsync(id);
        if (existing == null) throw new InvalidOperationException($"Proxy {id} not found");

        await _repo.UpdateNameAsync(id, name.Trim());
    }

    public async Task UpdateProxyNotesAsync(int id, string notes)
    {
        var existing = await _repo.GetByIdAsync(id);
        if (existing == null) throw new InvalidOperationException($"Proxy {id} not found");

        await _repo.UpdateNotesAsync(id, notes ?? "");
    }

    public async Task DeleteProxyAsync(int id)
    {
        var existing = await _repo.GetByIdAsync(id);
        if (existing == null) throw new InvalidOperationException($"Proxy {id} not found");

        await _repo.DeleteAsync(id);
    }

    public async Task BulkDeleteAsync(List<int> ids)
    {
        await _repo.BulkDeleteAsync(ids);
    }

    private async Task<(int? TypeId, string Host, int Port, string? Username, string? Password, string? RotaryApi, string? Type)?> ParseProxyStringWithType(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;

        var s = input.Trim();
        string? type = null;
        string host = "";
        int port = 0;
        string? username = null;
        string? password = null;
        string? rotaryApi = null;

        // Check for type prefix (http://, https://, socks4://, socks5://)
        var typeMatch = System.Text.RegularExpressions.Regex.Match(s, @"^(http|https|socks4|socks5)://", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (typeMatch.Success)
        {
            type = typeMatch.Groups[1].Value.ToLower();
            s = s.Substring(typeMatch.Groups[0].Length);
        }

        // Check for rotary API pattern (http://user:pass@host:port/rotary)
        var rotaryMatch = System.Text.RegularExpressions.Regex.Match(s, @"^(.+?)@(.+):(\d+)(?:/(.*))?$");
        if (rotaryMatch.Success)
        {
            username = rotaryMatch.Groups[1].Value;
            password = "";
            host = rotaryMatch.Groups[2].Value;
            port = int.Parse(rotaryMatch.Groups[3].Value);
            rotaryApi = rotaryMatch.Groups[4].Success ? rotaryMatch.Groups[4].Value : "";
        }
        else
        {
            // Check for auth@host:port
            var atIndex = s.LastIndexOf('@');
            if (atIndex > 0)
            {
                var auth = s.Substring(0, atIndex);
                var hostPart = s.Substring(atIndex + 1);
                var authParts = auth.Split(':');
                username = authParts[0];
                if (authParts.Length > 1) password = authParts[1];

                var hostPortParts = hostPart.Split(':');
                host = hostPortParts[0];
                if (hostPortParts.Length > 1) port = int.Parse(hostPortParts[1]);
            }
            else
            {
                // Plain host:port
                var parts = s.Split(':');
                host = parts[0];
                if (parts.Length > 1) port = int.Parse(parts[1]);
            }
        }

        if (string.IsNullOrEmpty(host) || port <= 0) return null;

        // Resolve TypeId if type is known
        int? typeId = null;
        if (!string.IsNullOrEmpty(type))
        {
            var proxyType = await _typeRepo.GetByValueAsync(type);
            if (proxyType != null)
            {
                typeId = proxyType.Id;
            }
        }

        return (typeId, host, port, username, password, rotaryApi, type);
    }

    public async Task<ProxyBulkCreateResult> CreateBulkProxiesAsync(List<string> proxyStrings)
    {
        int successCount = 0;
        int failCount = 0;
        var errors = new List<string>();

        Console.WriteLine($"[CreateBulkProxiesAsync] Starting with {proxyStrings.Count} proxies");

        foreach (var proxyStr in proxyStrings)
        {
            try
            {
                Console.WriteLine($"[CreateBulkProxiesAsync] Processing: {proxyStr}");

                // Check if it's a simple object with parsed type from scanner
                if (proxyStr.StartsWith("{"))
                {
                    // JSON format: {"host":"...", "port":..., "type":"...", ...}
                    try
                    {
                        var obj = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(proxyStr);
                        if (obj.TryGetProperty("host", out var h) && obj.TryGetProperty("port", out var p))
                        {
                            var host = h.GetString() ?? "";
                            var port = p.GetInt32();
                            var type = obj.TryGetProperty("type", out var t) ? t.GetString() : null;
                            var username = obj.TryGetProperty("username", out var u) ? u.GetString() : null;
                            var password = obj.TryGetProperty("password", out var pw) ? pw.GetString() : null;

                            if (!string.IsNullOrEmpty(host) && port > 0)
                            {
                                int? typeId = null;
                                if (!string.IsNullOrEmpty(type))
                                {
                                    var proxyType = await _typeRepo.GetByValueAsync(type);
                                    if (proxyType != null) typeId = proxyType.Id;
                                }

                                var proxyObj = new Proxy
                                {
                                    Name = GenerateRandomName(),
                                    TypeId = typeId,
                                    Host = host,
                                    Port = port,
                                    Username = username ?? "",
                                    Password = password ?? "",
                                    RotaryApi = "",
                                    Tags = "[]",
                                    CreatedAt = DateTime.Now
                                };
                                await _repo.CreateAsync(proxyObj);
                                successCount++;
                                Console.WriteLine($"[CreateBulkProxiesAsync] Success (JSON): {host}:{port}");
                                continue;
                            }
                        }
                    }
                    catch (Exception jsonEx)
                    {
                        Console.WriteLine($"[CreateBulkProxiesAsync] JSON parse error: {jsonEx.Message}");
                    }
                }

                // Regular string format
                var parsed = ParseProxyString(proxyStr);
                Console.WriteLine($"[CreateBulkProxiesAsync] Parsed: Host={parsed?.Host}, Port={parsed?.Port}, TypeId={parsed?.TypeId}");
                
                if (parsed == null || string.IsNullOrEmpty(parsed.Value.Host) || parsed.Value.Port <= 0)
                {
                    failCount++;
                    errors.Add($"Invalid format: {proxyStr}");
                    Console.WriteLine($"[CreateBulkProxiesAsync] Failed (invalid): {proxyStr}");
                    continue;
                }

                var newProxy = new Proxy
                {
                    Name = GenerateRandomName(),
                    TypeId = parsed.Value.TypeId,
                    Host = parsed.Value.Host,
                    Port = parsed.Value.Port,
                    Username = parsed.Value.Username ?? "",
                    Password = parsed.Value.Password ?? "",
                    RotaryApi = parsed.Value.RotaryApi ?? "",
                    Tags = "[]",
                    CreatedAt = DateTime.Now
                };

                await _repo.CreateAsync(newProxy);
                successCount++;
                Console.WriteLine($"[CreateBulkProxiesAsync] Success: {newProxy.Host}:{newProxy.Port}");
            }
            catch (Exception ex)
            {
                failCount++;
                errors.Add($"{proxyStr}: {ex.Message}");
                Console.WriteLine($"[CreateBulkProxiesAsync] Exception: {ex}");
            }
        }

        Console.WriteLine($"[CreateBulkProxiesAsync] Done: {successCount} success, {failCount} failed");
        return new ProxyBulkCreateResult(successCount, failCount, errors);
    }

    private (int? TypeId, string Host, int Port, string? Username, string? Password, string? RotaryApi)? ParseProxyString(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;

        var s = input.Trim();
        string? type = null; // No default - will be detected by scanner
        string host = "";
        int port = 0;
        string? username = null;
        string? password = null;
        string? rotaryApi = null;

        // Check for type prefix (http://, https://, socks4://, socks5://)
        var typeMatch = System.Text.RegularExpressions.Regex.Match(s, @"^(http|https|socks4|socks5)://", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (typeMatch.Success)
        {
            type = typeMatch.Groups[1].Value.ToLower();
            s = s.Substring(typeMatch.Groups[0].Length);
        }

        // Check for rotary API pattern (http://user:pass@host:port/rotary)
        var rotaryMatch = System.Text.RegularExpressions.Regex.Match(s, @"^(.+?)@(.+):(\d+)(?:/(.*))?$");
        if (rotaryMatch.Success)
        {
            username = rotaryMatch.Groups[1].Value;
            password = "";
            host = rotaryMatch.Groups[2].Value;
            port = int.Parse(rotaryMatch.Groups[3].Value);
            rotaryApi = rotaryMatch.Groups[4].Success ? rotaryMatch.Groups[4].Value : "";
        }
        else
        {
            // Check for auth@host:port
            var atIndex = s.LastIndexOf('@');
            if (atIndex > 0)
            {
                var auth = s.Substring(0, atIndex);
                var hostPart = s.Substring(atIndex + 1);
                var authParts = auth.Split(':');
                if (authParts.Length >= 1) username = authParts[0];
                if (authParts.Length >= 2) password = authParts[1];

                var hostParts = hostPart.Split(':');
                host = hostParts[0];
                if (hostParts.Length > 1) port = int.Parse(hostParts[1]);
            }
            else
            {
                // Just host:port or host:port:user:pass
                var parts = s.Split(':');
                if (parts.Length >= 2)
                {
                    host = parts[0];
                    port = int.Parse(parts[1]);
                    if (parts.Length >= 4)
                    {
                        username = parts[2];
                        password = parts[3];
                    }
                }
            }
        }

        if (string.IsNullOrEmpty(host) || port <= 0) return null;

        // Get TypeId from type string
        int? typeId = null;
        if (!string.IsNullOrWhiteSpace(type))
        {
            var proxyType = _typeRepo.GetByValueAsync(type).Result;
            typeId = proxyType?.Id;
        }

        return (typeId, host, port, username, password, rotaryApi);
    }

    public async Task<ProxyCheckResult> CheckProxyAsync(int id)
    {
        var proxy = await _repo.GetByIdAsync(id);
        if (proxy == null) return new ProxyCheckResult { Status = "not_found" };

        // Resolve type from TypeId
        var typeValue = proxy.TypeId.HasValue
            ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
            : "http";

        var result = await CheckProxyAsync(new ProxyCheckRequest(typeValue, proxy.Host, proxy.Port, proxy.Username, proxy.Password));

        // Update runtime status
        ProxyStatusService.SetStatus(id, result.Status, result.LatencyMs, result.Message);

        return result;
    }

    public async Task<string> ExportProxiesAsync(List<int> ids, string format = "default")
    {
        var proxies = ids.Count > 0
            ? await _repo.GetByIdsAsync(ids)
            : await _repo.GetAllAsync();

        var lines = new List<string>();
        foreach (var proxy in proxies)
        {
            var type = proxy.TypeId.HasValue
                ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                : "http";

            var line = format.ToLower() switch
            {
                "full" => $"{type}://{proxy.Host}:{proxy.Port}:{proxy.Username}:{proxy.Password}",
                "host" => $"{proxy.Host}:{proxy.Port}",
                "userpass" => $"{proxy.Host}:{proxy.Port}:{proxy.Username}:{proxy.Password}",
                _ => $"{type}://{proxy.Host}:{proxy.Port}:{proxy.Username}:{proxy.Password}"
            };
            lines.Add(line);
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "DuckGo", "Exports");
        Directory.CreateDirectory(tempDir);
        var fileName = $"proxies_export_{DateTime.Now:yyyyMMdd_HHmmss}.txt";
        var filePath = Path.Combine(tempDir, fileName);
        await File.WriteAllLinesAsync(filePath, lines);

        return filePath;
    }

    public async Task<string> CopyProxiesAsFormatAsync(List<int> ids, string format = "default")
    {
        var proxies = ids.Count > 0
            ? await _repo.GetByIdsAsync(ids)
            : await _repo.GetAllAsync();

        var formatLower = format.ToLower();
        
        // CSV format
        if (formatLower == "csv")
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("Host,Port,Type,Username,Password");
            foreach (var proxy in proxies)
            {
                var type = proxy.TypeId.HasValue
                    ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                    : "http";
                var escapedUser = proxy.Username?.Replace("\"", "\"\"") ?? "";
                var escapedPass = proxy.Password?.Replace("\"", "\"\"") ?? "";
                sb.AppendLine($"\"{proxy.Host}\",{proxy.Port},\"{type}\",\"{escapedUser}\",\"{escapedPass}\"");
            }
            return sb.ToString();
        }
        
        // JSON format
        if (formatLower == "json")
        {
            var items = new List<object>();
            foreach (var proxy in proxies)
            {
                var type = proxy.TypeId.HasValue
                    ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                    : "http";
                items.Add(new {
                    host = proxy.Host,
                    port = proxy.Port,
                    type = type,
                    username = proxy.Username,
                    password = proxy.Password
                });
            }
            return System.Text.Json.JsonSerializer.Serialize(items, new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        }
        
        // TXT format (default): one proxy per line
        var lines = new List<string>();
        foreach (var proxy in proxies)
        {
            var type = proxy.TypeId.HasValue
                ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                : "http";

            var line = formatLower switch
            {
                "host" => $"{proxy.Host}:{proxy.Port}",
                "userpass" => $"{proxy.Host}:{proxy.Port}:{proxy.Username}:{proxy.Password}",
                _ => $"{type}://{proxy.Host}:{proxy.Port}:{proxy.Username}:{proxy.Password}"
            };
            lines.Add(line);
        }

        return string.Join(Environment.NewLine, lines);
    }

    public async Task<List<ProxyCheckResult>> CheckProxiesAsync(List<int> ids)
    {
        var results = new List<ProxyCheckResult>();
        foreach (var id in ids)
        {
            var result = await CheckProxyAsync(id);
            results.Add(result);
        }
        return results;
    }

    public async Task<ProxyCheckResult> CheckProxyAsync(ProxyCheckRequest req)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        // Faster timeout for scanning - 5 seconds max
        var timeout = TimeSpan.FromSeconds(5);
        
        // Parse actual host and type from req.Host if it contains protocol prefix
        string actualHost = req.Host;
        string type = req.Type?.ToLower() ?? "http";
        
        if (!string.IsNullOrEmpty(req.Host) && req.Host.Contains("://"))
        {
            var colonIdx = req.Host.IndexOf("://");
            type = req.Host.Substring(0, colonIdx).ToLower();
            actualHost = req.Host.Substring(colonIdx + 3);
            var atIdx = actualHost.LastIndexOf('@');
            if (atIdx > 0) actualHost = actualHost.Substring(atIdx + 1);
        }
        
        try
        {
            // Fast TCP connect check - this is enough to verify proxy is reachable
            // HTTP request through proxy is slow and often fails due to various proxy configurations
            using var tcp = new TcpClient();
            var cancel = new CancellationTokenSource(timeout);
            await tcp.ConnectAsync(actualHost, req.Port, cancel.Token);
            sw.Stop();
            
            // TCP connected successfully - proxy is alive
            var tcpLatency = (int)sw.ElapsedMilliseconds;
            
            return new ProxyCheckResult 
            { 
                Status = "alive", 
                LatencyMs = tcpLatency,
                Message = "TCP OK"
            };
        }
        catch (OperationCanceledException)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "timeout", LatencyMs = (int)sw.ElapsedMilliseconds, Message = "Connection timed out" };
        }
        catch (SocketException ex)
        {
            sw.Stop();
            var message = ex.SocketErrorCode switch
            {
                SocketError.ConnectionRefused => "Connection refused",
                SocketError.HostUnreachable => "Host unreachable",
                SocketError.NetworkUnreachable => "Network unreachable",
                SocketError.TimedOut => "Connection timed out",
                _ => ex.Message
            };
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = message };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = ex.Message };
        }
    }
    
    // Ultra-fast scan using raw socket connection without DNS lookup
    public async Task<ProxyCheckResult> CheckProxyFastAsync(ProxyCheckRequest req)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var timeout = TimeSpan.FromSeconds(5); // Quick scan: 5 second timeout
        
        string actualHost = req.Host;
        string type = req.Type?.ToLower() ?? "http";
        
        if (!string.IsNullOrEmpty(req.Host) && req.Host.Contains("://"))
        {
            var colonIdx = req.Host.IndexOf("://");
            type = req.Host.Substring(0, colonIdx).ToLower();
            actualHost = req.Host.Substring(colonIdx + 3);
            var atIdx = actualHost.LastIndexOf('@');
            if (atIdx > 0) actualHost = actualHost.Substring(atIdx + 1);
        }
        
        try
        {
            // Use Dns.GetHostAddresses for faster DNS resolution
            IPAddress[] addresses = await Dns.GetHostAddressesAsync(actualHost);
            if (addresses.Length == 0)
            {
                sw.Stop();
                return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = "DNS resolution failed" };
            }
            
            using var tcp = new TcpClient();
            var cancel = new CancellationTokenSource(timeout);
            await tcp.ConnectAsync(addresses[0], req.Port, cancel.Token);
            sw.Stop();
            
            return new ProxyCheckResult 
            { 
                Status = "alive", 
                LatencyMs = (int)sw.ElapsedMilliseconds,
                Message = "TCP OK"
            };
        }
        catch (OperationCanceledException)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "timeout", LatencyMs = (int)sw.ElapsedMilliseconds, Message = "Connection timed out" };
        }
        catch (SocketException ex)
        {
            sw.Stop();
            var message = ex.SocketErrorCode switch
            {
                SocketError.ConnectionRefused => "Connection refused",
                SocketError.HostUnreachable => "Host unreachable",
                SocketError.NetworkUnreachable => "Network unreachable",
                SocketError.TimedOut => "Connection timed out",
                SocketError.HostNotFound => "Host not found",
                _ => ex.Message
            };
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = message };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = ex.Message };
        }
    }
    
    // Deep check with HTTP validation - longer timeout, more thorough
    public async Task<ProxyCheckResult> CheckProxyDeepAsync(int id)
    {
        var proxy = await _repo.GetByIdAsync(id);
        if (proxy == null) return new ProxyCheckResult { Status = "not_found" };

        var typeValue = proxy.TypeId.HasValue
            ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
            : "http";

        var result = await CheckProxyDeepAsync(new ProxyCheckRequest(typeValue, proxy.Host, proxy.Port, proxy.Username, proxy.Password));
        ProxyStatusService.SetStatus(id, result.Status, result.LatencyMs, result.Message);

        return result;
    }
    
    public async Task<ProxyCheckResult> CheckProxyDeepAsync(ProxyCheckRequest req)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var timeout = TimeSpan.FromSeconds(15); // Deep check: 15 second timeout
        
        string actualHost = req.Host;
        string type = req.Type?.ToLower() ?? "http";
        bool isSocks = type == "socks5" || type == "socks4" || type == "socks";
        
        if (!string.IsNullOrEmpty(req.Host) && req.Host.Contains("://"))
        {
            var colonIdx = req.Host.IndexOf("://");
            type = req.Host.Substring(0, colonIdx).ToLower();
            actualHost = req.Host.Substring(colonIdx + 3);
            var atIdx = actualHost.LastIndexOf('@');
            if (atIdx > 0) actualHost = actualHost.Substring(atIdx + 1);
            isSocks = type == "socks5" || type == "socks4" || type == "socks";
        }
        
        try
        {
            // TCP connect check
            using var tcp = new TcpClient();
            var cancel = new CancellationTokenSource(timeout);
            await tcp.ConnectAsync(actualHost, req.Port, cancel.Token);
            sw.Stop();
            
            var tcpLatency = (int)sw.ElapsedMilliseconds;
            
            // For SOCKS, TCP connect is enough
            if (isSocks)
            {
                return new ProxyCheckResult 
                { 
                    Status = "alive", 
                    LatencyMs = tcpLatency,
                    Message = $"{type.ToUpper()} OK"
                };
            }
            
            // For HTTP/HTTPS: Try HTTP request through proxy
            try
            {
                var proxyUri = new Uri($"http://{actualHost}:{req.Port}");
                var proxy = new WebProxy(proxyUri, false);
                
                if (!string.IsNullOrEmpty(req.Username))
                {
                    proxy.Credentials = new NetworkCredential(req.Username, req.Password ?? "");
                }

                var handler = new HttpClientHandler
                {
                    Proxy = proxy,
                    UseProxy = true
                };

                using var client = new HttpClient(handler);
                client.Timeout = TimeSpan.FromSeconds(12);
                
                var response = await client.GetAsync("http://www.google.com/generate_204", HttpCompletionOption.ResponseHeadersRead);
                return new ProxyCheckResult 
                { 
                    Status = "alive", 
                    LatencyMs = tcpLatency,
                    Message = "HTTP OK"
                };
            }
            catch (HttpRequestException httpEx)
            {
                if (httpEx.StatusCode == System.Net.HttpStatusCode.ProxyAuthenticationRequired)
                {
                    return new ProxyCheckResult 
                    { 
                        Status = "alive", 
                        LatencyMs = tcpLatency,
                        Message = "Auth required (working)"
                    };
                }
                
                // TCP worked but HTTP failed - might be different protocol
                return new ProxyCheckResult 
                { 
                    Status = "alive", 
                    LatencyMs = tcpLatency,
                    Message = "TCP OK"
                };
            }
        }
        catch (OperationCanceledException)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "timeout", LatencyMs = (int)sw.ElapsedMilliseconds, Message = "Connection timed out" };
        }
        catch (SocketException ex)
        {
            sw.Stop();
            var message = ex.SocketErrorCode switch
            {
                SocketError.ConnectionRefused => "Connection refused",
                SocketError.HostUnreachable => "Host unreachable",
                SocketError.NetworkUnreachable => "Network unreachable",
                SocketError.TimedOut => "Connection timed out",
                _ => ex.Message
            };
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = message };
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds, Message = ex.Message };
        }
    }

    // Profile Group methods
    public async Task<List<ProfileGroup>> GetGroupsAsync()
        => await _groupRepo.GetAllAsync();

    public async Task<ProfileGroup> CreateGroupAsync(ProxyGroupCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Group name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Group name must be 30 characters or less");

        if (await _groupRepo.ExistsByNameAsync(name))
            throw new InvalidOperationException($"Group '{name}' already exists");

        var group = new ProfileGroup { Name = name, CreatedAt = DateTime.Now };
        var id = await _groupRepo.CreateAsync(group);
        group.Id = id;
        return group;
    }

    public async Task UpdateGroupAsync(ProxyGroupUpdateRequest req)
    {
        var existing = await _groupRepo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Group {req.Id} not found");

        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Group name is required");

        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Group name must be 30 characters or less");

        if (await _groupRepo.ExistsByNameAsync(name, req.Id))
            throw new InvalidOperationException($"Group '{name}' already exists");

        existing.Name = name;
        await _groupRepo.UpdateAsync(existing);
    }

    public async Task DeleteGroupAsync(int id)
    {
        await _groupRepo.DeleteAsync(id);
    }

    public async Task DeleteGroupWithProxiesAsync(int id)
    {
        await _repo.BulkDeleteByGroupAsync(id);
        await _groupRepo.DeleteAsync(id);
    }
    
    // Helper methods for scanner
    public async Task<List<Proxy>> GetProxiesByIdsAsync(List<int> ids)
    {
        return await _repo.GetByIdsAsync(ids);
    }
    
    public async Task<string?> GetProxyTypeValueAsync(int typeId)
    {
        var type = await _typeRepo.GetByIdAsync(typeId);
        return type?.Value;
    }
    
    public async Task UpdateProxyStatusAsync(int id, string status, int latencyMs, string? message)
    {
        await _repo.UpdateStatusAsync(id, status, latencyMs, message);
        ProxyStatusService.SetStatus(id, status, latencyMs, message);
    }

    // Profile Tag methods
    public async Task<List<ProfileTag>> GetTagsAsync()
        => await _tagRepo.GetAllAsync();

    public async Task<ProfileTag> CreateTagAsync(ProxyTagCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Tag name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Tag name must be 30 characters or less");

        if (await _tagRepo.ExistsByNameAsync(name))
            throw new InvalidOperationException($"Tag '{name}' already exists");

        var tag = new ProfileTag { Name = name, CreatedAt = DateTime.Now };
        var id = await _tagRepo.CreateAsync(tag);
        tag.Id = id;
        return tag;
    }

    public async Task UpdateTagAsync(ProxyTagUpdateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Tag name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Tag name must be 30 characters or less");

        if (await _tagRepo.ExistsByNameAsync(name, req.Id))
            throw new InvalidOperationException($"Tag '{name}' already exists");

        await _tagRepo.UpdateAsync(req.Id, name);
    }

    public async Task DeleteTagAsync(int id)
    {
        await _tagRepo.DeleteAsync(id);
    }

    // Import helpers - parse proxies from file content (txt, csv, json)
    public async Task<List<ProxyImportItem>> ParseProxiesFromContentAsync(string content)
    {
        var items = new List<ProxyImportItem>();
        if (string.IsNullOrWhiteSpace(content)) return items;

        // Get valid proxy types from database
        var validTypes = (await _typeRepo.GetAllAsync())
            .Select(t => t.Value.ToLower())
            .ToHashSet();

        var rawLines = content.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
        var seen = new HashSet<string>();

        foreach (var raw in rawLines)
        {
            var line = raw.Trim();
            if (string.IsNullOrEmpty(line)) continue;

            var parsed = ParseProxyLine(line, validTypes);
            if (parsed == null) continue;

            var (type, host, port, username, password) = parsed.Value;
            
            // Build standardized proxy string for textarea (no type:// prefix for non-auth)
            string proxyStr;
            if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password))
            {
                proxyStr = $"{type}://{username}:{password}@{host}:{port}";
            }
            else
            {
                proxyStr = $"{host}:{port}:{username ?? ""}:{password ?? ""}".TrimEnd(':');
            }

            // Deduplicate
            if (seen.Contains(proxyStr)) continue;
            seen.Add(proxyStr);
            items.Add(new ProxyImportItem { ProxyString = proxyStr, Type = type, Host = host, Port = port, Username = username, Password = password });
        }

        return items;
    }

    private (string type, string host, int port, string? username, string? password)? ParseProxyLine(string input, HashSet<string> validTypes)
    {
        var s = input.Trim();
        string type = "http";
        string? username = null, password = null;

        // Detect format and parse
        if (s.StartsWith("{") || s.StartsWith("["))
        {
            // Try JSON format
            try
            {
                var json = JsonSerializer.Deserialize<JsonElement>(s);
                if (json.ValueKind == JsonValueKind.Array)
                {
                    if (json.GetArrayLength() > 0)
                        json = json[0];
                }
                
                if (json.ValueKind == JsonValueKind.Object)
                {
                    var host = json.TryGetProperty("host", out var h) ? h.GetString() : null;
                    var port = json.TryGetProperty("port", out var p) ? p.GetInt32() : 0;
                    username = json.TryGetProperty("username", out var u) ? u.GetString() : null;
                    password = json.TryGetProperty("password", out var pw) ? pw.GetString() : null;
                    var parsedType = json.TryGetProperty("type", out var t) ? t.GetString() ?? "http" : "http";

                    // Validate type against database
                    if (validTypes.Contains(parsedType.ToLower()))
                        type = parsedType;

                    if (!string.IsNullOrEmpty(host) && port > 0 && port <= 65535)
                        return (type, host, port, username, password);
                }
            }
            catch { }
        }
        else if (s.Contains(",") && !s.Contains("://"))
        {
            // CSV format: Host,Port,Type,Username,Password
            var parts = s.Split(',');
            if (parts.Length >= 2)
            {
                var host = parts[0].Trim().Trim('"');
                if (int.TryParse(parts[1].Trim().Trim('"'), out var port))
                {
                    var csvType = parts.Length > 2 ? parts[2].Trim().Trim('"') : "http";
                    username = parts.Length > 3 && !string.IsNullOrEmpty(parts[3].Trim().Trim('"')) ? parts[3].Trim().Trim('"') : null;
                    password = parts.Length > 4 && !string.IsNullOrEmpty(parts[4].Trim().Trim('"')) ? parts[4].Trim().Trim('"') : null;

                    // Validate type
                    if (validTypes.Contains(csvType.ToLower()))
                        type = csvType;

                    if (!string.IsNullOrEmpty(host) && port > 0 && port <= 65535)
                        return (type, host, port, username, password);
                }
            }
        }
        else
        {
            // Plain text format: host:port, type://host:port, type://user:pass@host:port, host:port:user:pass
            var work = s;
            
            // Check for protocol prefix
            var protoMatch = System.Text.RegularExpressions.Regex.Match(work, @"^(http|https|socks4|socks5)://", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (protoMatch.Success)
            {
                var parsedType = protoMatch.Value.ToLower().Replace("://", "");
                if (validTypes.Contains(parsedType))
                    type = parsedType;
                work = work.Substring(protoMatch.Length);
            }

            // Check for auth in URL format user:pass@
            var atIdx = work.LastIndexOf('@');
            if (atIdx > 0)
            {
                var authPart = work.Substring(0, atIdx);
                var authParts = authPart.Split(':');
                if (authParts.Length >= 2)
                {
                    username = authParts[0];
                    password = string.Join(":", authParts.Skip(1));
                }
                work = work.Substring(atIdx + 1);
            }

            // Split host:port
            var hpParts = work.Split(':');
            if (hpParts.Length >= 2)
            {
                var host = hpParts[0];
                if (int.TryParse(hpParts[1], out var port))
                {
                    // If no protocol and has 4 parts, it's host:port:user:pass
                    if (protoMatch == System.Text.RegularExpressions.Match.Empty && hpParts.Length >= 4)
                    {
                        type = "http";
                        username = hpParts[2];
                        password = hpParts[3];
                        return (type, host, port, username, password);
                    }
                    
                    if (!string.IsNullOrEmpty(host) && port > 0 && port <= 65535)
                        return (type, host, port, username, password);
                }
            }
        }

        return null;
    }

    public async Task<List<ProxyScanResult>> ScanProxiesParallelAsync(List<int> proxyIds, int maxDegreeOfParallelism = 50, string? scanId = null)
    {
        var proxies = await _repo.GetByIdsAsync(proxyIds);
        var results = new List<ProxyScanResult>();
        var semaphore = new SemaphoreSlim(maxDegreeOfParallelism);
        var lockObj = new object();
        var processedCount = 0;

        var tasks = proxies.Select(async proxy =>
        {
            // Check if scan was cancelled
            if (!string.IsNullOrEmpty(scanId) && !ProxyScanManager.IsScanActive(scanId))
                return;

            await semaphore.WaitAsync();
            try
            {
                // Check again if cancelled
                if (!string.IsNullOrEmpty(scanId) && !ProxyScanManager.IsScanActive(scanId))
                    return;

                var typeValue = proxy.TypeId.HasValue 
                    ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                    : "http";
                    
                var checkReq = new ProxyCheckRequest(typeValue, proxy.Host, proxy.Port, proxy.Username, proxy.Password);
                // Use fast check for scanning - no HTTP request, just TCP connect
                var result = await CheckProxyFastAsync(checkReq);
                
                // Update proxy status in DB
                await _repo.UpdateStatusAsync(proxy.Id, result.Status, result.LatencyMs, result.Message);
                
                // Update runtime status
                ProxyStatusService.SetStatus(proxy.Id, result.Status, result.LatencyMs, result.Message);

                lock (lockObj)
                {
                    processedCount++;
                    results.Add(new ProxyScanResult
                    {
                        ProxyId = proxy.Id,
                        Host = proxy.Host,
                        Port = proxy.Port,
                        Type = typeValue,
                        Status = result.Status,
                        LatencyMs = result.LatencyMs,
                        Message = result.Message,
                        Progress = (processedCount * 100) / proxies.Count
                    });
                }
            }
            catch (Exception ex)
            {
                lock (lockObj)
                {
                    processedCount++;
                    results.Add(new ProxyScanResult
                    {
                        ProxyId = proxy.Id,
                        Host = proxy.Host,
                        Port = proxy.Port,
                        Status = "dead",
                        Message = $"Error: {ex.Message}",
                        Progress = (processedCount * 100) / proxies.Count
                    });
                }
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
        return results;
    }
    
    // Background scan with progress callback for real-time updates
    public async Task ScanProxiesWithProgressAsync(
        List<int> proxyIds, 
        int maxDegreeOfParallelism = 50,
        IProgress<ProxyScanProgress>? progress = null,
        CancellationToken cancellationToken = default)
    {
        var proxies = await _repo.GetByIdsAsync(proxyIds);
        var semaphore = new SemaphoreSlim(maxDegreeOfParallelism);
        var lockObj = new object();
        var processedCount = 0;
        var aliveCount = 0;
        var deadCount = 0;
        var timeoutCount = 0;

        var tasks = proxies.Select(async proxy =>
        {
            if (cancellationToken.IsCancellationRequested)
                return;

            await semaphore.WaitAsync(cancellationToken);
            try
            {
                if (cancellationToken.IsCancellationRequested)
                    return;

                var typeValue = proxy.TypeId.HasValue 
                    ? (await _typeRepo.GetByIdAsync(proxy.TypeId.Value))?.Value ?? "http"
                    : "http";
                    
                var checkReq = new ProxyCheckRequest(typeValue, proxy.Host, proxy.Port, proxy.Username, proxy.Password);
                // Use fast check for scanning - no HTTP request, just TCP connect
                var result = await CheckProxyFastAsync(checkReq);
                
                // Update proxy status in DB
                await _repo.UpdateStatusAsync(proxy.Id, result.Status, result.LatencyMs, result.Message);
                
                // Update runtime status
                ProxyStatusService.SetStatus(proxy.Id, result.Status, result.LatencyMs, result.Message);

                lock (lockObj)
                {
                    processedCount++;
                    if (result.Status == "alive") aliveCount++;
                    else if (result.Status == "timeout") timeoutCount++;
                    else deadCount++;

                    progress?.Report(new ProxyScanProgress
                    {
                        ProxyId = proxy.Id,
                        Host = proxy.Host,
                        Port = proxy.Port,
                        Type = typeValue,
                        Status = result.Status,
                        LatencyMs = result.LatencyMs,
                        Message = result.Message,
                        ProcessedCount = processedCount,
                        TotalCount = proxies.Count,
                        AliveCount = aliveCount,
                        DeadCount = deadCount,
                        TimeoutCount = timeoutCount,
                        ProgressPercent = (processedCount * 100) / proxies.Count
                    });
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when cancelled
            }
            catch (Exception ex)
            {
                lock (lockObj)
                {
                    processedCount++;
                    deadCount++;
                    progress?.Report(new ProxyScanProgress
                    {
                        ProxyId = proxy.Id,
                        Host = proxy.Host,
                        Port = proxy.Port,
                        Status = "dead",
                        Message = $"Error: {ex.Message}",
                        ProcessedCount = processedCount,
                        TotalCount = proxies.Count,
                        AliveCount = aliveCount,
                        DeadCount = deadCount,
                        TimeoutCount = timeoutCount,
                        ProgressPercent = (processedCount * 100) / proxies.Count
                    });
                }
            }
            finally
            {
                semaphore.Release();
            }
        });

        try
        {
            await Task.WhenAll(tasks);
        }
        catch (OperationCanceledException)
        {
            // Scan was cancelled
        }
    }
}

public class ProxyCheckResult
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = "dead";
    
    [JsonPropertyName("latencyMs")]
    public int LatencyMs { get; set; }
    
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

// Runtime status service for proxy checking
public static class ProxyStatusService
{
    private static readonly Dictionary<int, (string Status, int LatencyMs, string? Message, DateTime CheckedAt)> _statuses = new();
    private static readonly object _lock = new();

    public static string? GetStatus(int proxyId)
    {
        lock (_lock)
        {
            if (_statuses.TryGetValue(proxyId, out var info))
                return info.Status;
            return null;
        }
    }

    public static string? GetMessage(int proxyId)
    {
        lock (_lock)
        {
            if (_statuses.TryGetValue(proxyId, out var info))
                return info.Message;
            return null;
        }
    }

    public static int? GetLatency(int proxyId)
    {
        lock (_lock)
        {
            if (_statuses.TryGetValue(proxyId, out var info))
                return info.LatencyMs;
            return null;
        }
    }

    public static void SetStatus(int proxyId, string status, int latencyMs, string? message)
    {
        lock (_lock)
        {
            _statuses[proxyId] = (status, latencyMs, message, DateTime.Now);
        }
    }

    public static void ClearStatus(int proxyId)
    {
        lock (_lock)
        {
            _statuses.Remove(proxyId);
        }
    }

    public static Dictionary<int, (string Status, int LatencyMs, string? Message)> GetAllStatuses()
    {
        lock (_lock)
        {
            return _statuses.ToDictionary(
                kvp => kvp.Key,
                kvp => (kvp.Value.Status, kvp.Value.LatencyMs, kvp.Value.Message)
            );
        }
    }
}

public class ProxyImportItem
{
    [JsonPropertyName("proxyString")]
    public string ProxyString { get; set; } = "";
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = "http";
    
    [JsonPropertyName("host")]
    public string Host { get; set; } = "";
    
    [JsonPropertyName("port")]
    public int Port { get; set; }
    
    [JsonPropertyName("username")]
    public string? Username { get; set; }
    
    [JsonPropertyName("password")]
    public string? Password { get; set; }
}

public class ProxyScanResult
{
    [JsonPropertyName("proxyId")]
    public int ProxyId { get; set; }
    
    [JsonPropertyName("host")]
    public string Host { get; set; } = "";
    
    [JsonPropertyName("port")]
    public int Port { get; set; }
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = "http";
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = "unknown";
    
    [JsonPropertyName("latencyMs")]
    public int LatencyMs { get; set; }
    
    [JsonPropertyName("message")]
    public string? Message { get; set; }
    
    [JsonPropertyName("progress")]
    public int Progress { get; set; }
}

public class ProxyScanProgress
{
    [JsonPropertyName("proxyId")]
    public int ProxyId { get; set; }
    
    [JsonPropertyName("host")]
    public string Host { get; set; } = "";
    
    [JsonPropertyName("port")]
    public int Port { get; set; }
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = "http";
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = "unknown";
    
    [JsonPropertyName("latencyMs")]
    public int LatencyMs { get; set; }
    
    [JsonPropertyName("message")]
    public string? Message { get; set; }
    
    [JsonPropertyName("processedCount")]
    public int ProcessedCount { get; set; }
    
    [JsonPropertyName("totalCount")]
    public int TotalCount { get; set; }
    
    [JsonPropertyName("aliveCount")]
    public int AliveCount { get; set; }
    
    [JsonPropertyName("deadCount")]
    public int DeadCount { get; set; }
    
    [JsonPropertyName("timeoutCount")]
    public int TimeoutCount { get; set; }
    
    [JsonPropertyName("progressPercent")]
    public int ProgressPercent { get; set; }
}
