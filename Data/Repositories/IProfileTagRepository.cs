using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IProfileTagRepository
{
    Task<List<ProfileTag>> GetAllAsync();
    Task<bool> ExistsByNameAsync(string name, int? excludeId = null);
    Task<int> CreateAsync(ProfileTag tag);
    Task UpdateAsync(int id, string name);
    Task DeleteAsync(int id);
}
