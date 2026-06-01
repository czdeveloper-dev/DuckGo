using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IProfileRepository
{
    Task<List<Profile>> GetAllAsync(string? search = null, int? groupId = null, List<int>? tagIds = null, string? browserType = null);
    Task<Profile?> GetByIdAsync(int id);
    Task<int> CreateAsync(Profile profile);
    Task UpdateAsync(Profile profile);
    Task DeleteAsync(int id);
    Task BulkDeleteAsync(List<int> ids);
    Task BulkAssignGroupAsync(List<int> profileIds, int? groupId);
    Task UpdateLastOpenedAsync(int id);
}
