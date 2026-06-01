using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface IGroupRepository
{
    Task<List<ProfileGroup>> GetAllAsync();
    Task<ProfileGroup?> GetByIdAsync(int id);
    Task<int> CreateAsync(ProfileGroup group);
    Task UpdateAsync(ProfileGroup group);
    Task DeleteAsync(int id);
}
