using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IProxyRepository
{
    Task<List<Proxy>> GetAllAsync(
        string? search = null,
        string? idStr = null,
        int? groupId = null,
        List<int>? tagIds = null);
    Task<List<Proxy>> GetByIdsAsync(List<int> ids);
    Task<Proxy?> GetByIdAsync(int id);
    Task<int> CreateAsync(Proxy proxy);
    Task UpdateAsync(Proxy proxy);
    Task UpdateNameAsync(int id, string name);
    Task UpdateNotesAsync(int id, string notes);
    Task UpdateStatusAsync(int id, string status, int latencyMs, string? message);
    Task DeleteAsync(int id);
    Task BulkDeleteAsync(List<int> ids);
    Task BulkDeleteByGroupAsync(int groupId);
}
