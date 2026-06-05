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

    public async Task<ProfileTag> CreateTagAsync(TagCreateRequest req)
    {
        if (await _repo.ExistsByNameAsync(req.Name))
            throw new InvalidOperationException($"A tag with the name \"{req.Name}\" already exists.");
        var tag = new ProfileTag { Name = req.Name, CreatedAt = DateTime.Now };
        var id = await _repo.CreateAsync(tag);
        tag.Id = id;
        return tag;
    }

    public async Task UpdateTagAsync(TagUpdateRequest req)
    {
        if (await _repo.ExistsByNameAsync(req.Name, req.Id))
            throw new InvalidOperationException($"A tag with the name \"{req.Name}\" already exists.");
        await _repo.UpdateAsync(req.Id, req.Name);
    }

    public async Task DeleteTagAsync(int id)
        => await _repo.DeleteAsync(id);
}
