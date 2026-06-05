using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IGroupRepository
{
    Task<List<ProfileGroup>> GetAllAsync();
    Task<ProfileGroup?> GetByIdAsync(int id);
    Task<bool> ExistsByNameAsync(string name, int? excludeId = null);
    Task<int> CreateAsync(ProfileGroup group);
    Task UpdateAsync(ProfileGroup group);
    Task DeleteAsync(int id);
}
