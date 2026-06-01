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

    public async Task<int> CreateGroupAsync(GroupCreateRequest req)
    {
        var group = new ProfileGroup { Name = req.Name, CreatedAt = DateTime.Now };
        return await _repo.CreateAsync(group);
    }

    public async Task UpdateGroupAsync(GroupUpdateRequest req)
    {
        var existing = await _repo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Group {req.Id} not found");
        existing.Name = req.Name;
        await _repo.UpdateAsync(existing);
    }

    public async Task DeleteGroupAsync(int id)
        => await _repo.DeleteAsync(id);
}
