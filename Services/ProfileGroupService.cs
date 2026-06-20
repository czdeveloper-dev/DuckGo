using DuckGo.Data.Repositories;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ProfileGroupService
{
    private readonly IProfileGroupRepository _repo;

    public ProfileGroupService(IProfileGroupRepository repo) => _repo = repo;

    public async Task<List<ProfileGroup>> GetGroupsAsync()
        => await _repo.GetAllAsync();

    public async Task<ProfileGroup> CreateGroupAsync(GroupCreateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Group name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Group name must be 30 characters or less");

        if (await _repo.ExistsByNameAsync(name))
            throw new InvalidOperationException($"A group with the name \"{name}\" already exists.");
        var group = new ProfileGroup { Name = name, CreatedAt = DateTime.Now };
        var id = await _repo.CreateAsync(group);
        group.Id = id;
        return group;
    }

    public async Task UpdateGroupAsync(GroupUpdateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Group name is required");
        
        var name = req.Name.Trim();
        if (name.Length > 30)
            throw new ArgumentException("Group name must be 30 characters or less");

        var existing = await _repo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Group {req.Id} not found");
        if (await _repo.ExistsByNameAsync(name, req.Id))
            throw new InvalidOperationException($"A group with the name \"{name}\" already exists.");
        existing.Name = name;
        await _repo.UpdateAsync(existing);
    }

    public async Task DeleteGroupAsync(int id)
        => await _repo.DeleteAsync(id);
}
