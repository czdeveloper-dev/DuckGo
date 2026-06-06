using System.Net;
using System.Net.Sockets;
using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ProxyService
{
    private readonly IProxyRepository _repo;

    public ProxyService(IProxyRepository repo) => _repo = repo;

    private static string NormalizeType(string? type)
        => (type ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "https" => "https",
            "socks4" => "socks4",
            "socks5" => "socks5",
            _ => "http"
        };

    public async Task<List<Proxy>> GetProxiesAsync()
        => await _repo.GetAllAsync();

    public async Task<int> CreateProxyAsync(ProxyCreateRequest req)
    {
        var proxy = new Proxy
        {
            Name = req.Name,
            Type = NormalizeType(req.Type),
            Host = req.Host,
            Port = req.Port,
            Username = req.Username,
            Password = req.Password,
            Status = "active",
            CreatedAt = DateTime.Now
        };
        return await _repo.CreateAsync(proxy);
    }

    public async Task UpdateProxyAsync(ProxyUpdateRequest req)
    {
        var existing = await _repo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Proxy {req.Id} not found");
        existing.Name = req.Name;
        existing.Type = NormalizeType(req.Type);
        existing.Host = req.Host;
        existing.Port = req.Port;
        existing.Username = req.Username;
        existing.Password = req.Password;
        await _repo.UpdateAsync(existing);
    }

    public async Task DeleteProxyAsync(int id)
        => await _repo.DeleteAsync(id);

    public async Task<ProxyCheckResult> CheckProxyAsync(int id)
    {
        var proxy = await _repo.GetByIdAsync(id);
        if (proxy == null) return new ProxyCheckResult { Status = "not_found" };
        return await CheckProxyAsync(new ProxyCheckRequest(proxy.Type, proxy.Host, proxy.Port, proxy.Username, proxy.Password));
    }

    public async Task<ProxyCheckResult> CheckProxyAsync(ProxyCheckRequest req)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var tcp = new TcpClient();
            var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await tcp.ConnectAsync(req.Host, req.Port, cancel.Token);
            sw.Stop();
            return new ProxyCheckResult { Status = "alive", LatencyMs = (int)sw.ElapsedMilliseconds };
        }
        catch
        {
            sw.Stop();
            return new ProxyCheckResult { Status = "dead", LatencyMs = (int)sw.ElapsedMilliseconds };
        }
    }
}

public class ProxyCheckResult
{
    public string Status { get; set; } = "dead";
    public int LatencyMs { get; set; }
}
