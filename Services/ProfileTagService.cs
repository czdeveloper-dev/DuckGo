using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ProfileTagService
{
    private readonly IProfileTagRepository _repo;

    public ProfileTagService(IProfileTagRepository repo) => _repo = repo;

    public async Task<List<ProfileTag>> GetTagsAsync()
        => await _repo.GetAllAsync();

    public async Task<ProfileTag> CreateTagAsync(TagCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Tag name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Tag name must be 30 characters or less");

        if (await _repo.ExistsByNameAsync(name))
            throw new InvalidOperationException($"A tag with the name \"{name}\" already exists.");
        var tag = new ProfileTag { Name = name, CreatedAt = DateTime.Now };
        var id = await _repo.CreateAsync(tag);
        tag.Id = id;
        return tag;
    }

    public async Task UpdateTagAsync(TagUpdateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Tag name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Tag name must be 30 characters or less");

        if (await _repo.ExistsByNameAsync(name, req.Id))
            throw new InvalidOperationException($"A tag with the name \"{name}\" already exists.");
        await _repo.UpdateAsync(req.Id, name);
    }

    public async Task DeleteTagAsync(int id)
        => await _repo.DeleteAsync(id);
}
