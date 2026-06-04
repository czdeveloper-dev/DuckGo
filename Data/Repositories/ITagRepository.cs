using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public interface ITagRepository
{
    Task<List<ProfileTag>> GetAllAsync();
    Task<int> CreateAsync(ProfileTag tag);
    Task UpdateAsync(int id, string name);
    Task DeleteAsync(int id);
}
