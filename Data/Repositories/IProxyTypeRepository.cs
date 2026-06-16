using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IProxyTypeRepository
{
    Task<List<ProxyType>> GetAllAsync();
    Task<ProxyType?> GetByIdAsync(int id);
    Task<ProxyType?> GetByValueAsync(string value);
}
