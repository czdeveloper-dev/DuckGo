using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class GroupService
{
    private readonly IGroupRepository _repo;

    public GroupService(IGroupRepository repo) => _repo = repo;

    public async Task<List<ProfileGroup>> GetGroupsAsync()
        => await _repo.GetAllAsync();

    public async Task<ProfileGroup> CreateGroupAsync(GroupCreateRequest req)
    {
        if (await _repo.ExistsByNameAsync(req.Name))
            throw new InvalidOperationException($"A group with the name \"{req.Name}\" already exists.");
        var group = new ProfileGroup { Name = req.Name, CreatedAt = DateTime.Now };
        var id = await _repo.CreateAsync(group);
        group.Id = id;
        return group;
    }

    public async Task UpdateGroupAsync(GroupUpdateRequest req)
    {
        var existing = await _repo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Group {req.Id} not found");
        if (await _repo.ExistsByNameAsync(req.Name, req.Id))
            throw new InvalidOperationException($"A group with the name \"{req.Name}\" already exists.");
        existing.Name = req.Name;
        await _repo.UpdateAsync(existing);
    }

    public async Task DeleteGroupAsync(int id)
        => await _repo.DeleteAsync(id);
}
