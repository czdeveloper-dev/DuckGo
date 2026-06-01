using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IProxyRepository
{
    Task<List<Proxy>> GetAllAsync();
    Task<Proxy?> GetByIdAsync(int id);
    Task<int> CreateAsync(Proxy proxy);
    Task UpdateAsync(Proxy proxy);
    Task DeleteAsync(int id);
}
