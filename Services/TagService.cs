using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class TagService
{
    private readonly ITagRepository _repo;

    public TagService(ITagRepository repo) => _repo = repo;

    public async Task<List<ProfileTag>> GetTagsAsync()
        => await _repo.GetAllAsync();

    public async Task<int> CreateTagAsync(TagCreateRequest req)
    {
        var tag = new ProfileTag { Name = req.Name, CreatedAt = DateTime.Now };
        return await _repo.CreateAsync(tag);
    }

    public async Task DeleteTagAsync(int id)
        => await _repo.DeleteAsync(id);
}
