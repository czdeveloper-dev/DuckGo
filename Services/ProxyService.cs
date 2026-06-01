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

    public async Task<List<Proxy>> GetProxiesAsync()
        => await _repo.GetAllAsync();

    public async Task<int> CreateProxyAsync(ProxyCreateRequest req)
    {
        var proxy = new Proxy
        {
            Name = req.Name,
            Type = req.Type,
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
        existing.Type = req.Type;
        existing.Host = req.Host;
        existing.Port = req.Port;
        existing.Username = req.Username;
        existing.Password = req.Password;
        await _repo.UpdateAsync(existing);
    }

    public async Task DeleteProxyAsync(int id)
        => await _repo.DeleteAsync(id);

    public async Task<string> CheckProxyAsync(int id)
    {
        var proxy = await _repo.GetByIdAsync(id);
        if (proxy == null) return "not_found";

        try
        {
            using var tcp = new TcpClient();
            var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await tcp.ConnectAsync(proxy.Host, proxy.Port, cancel.Token);
            return "alive";
        }
        catch
        {
            return "dead";
        }
    }
}
