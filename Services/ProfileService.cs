using System.Text.Json;
using DuckGo.Data.Repositories;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ProfileService
{
    private readonly IProfileRepository _profileRepo;
    private readonly IGroupRepository _groupRepo;
    private readonly ITagRepository _tagRepo;
    private readonly IProxyRepository _proxyRepo;
    private readonly ProfileFolderService _folderService;
    private readonly ConfigBuilder _configBuilder;

    public ProfileService(
        IProfileRepository profileRepo,
        IGroupRepository groupRepo,
        ITagRepository tagRepo,
        IProxyRepository proxyRepo,
        ProfileFolderService folderService,
        ConfigBuilder configBuilder)
    {
        _profileRepo = profileRepo;
        _groupRepo = groupRepo;
        _tagRepo = tagRepo;
        _proxyRepo = proxyRepo;
        _folderService = folderService;
        _configBuilder = configBuilder;
    }

    public async Task<ProfileListResponse> GetProfilesAsync(
        string? search = null,
        int? groupId = null,
        List<int>? tagIds = null,
        string? browserType = null)
    {
        var profiles = await _profileRepo.GetAllAsync(search, groupId, tagIds, browserType);
        var allTags = await _tagRepo.GetAllAsync();
        var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);

        var items = profiles.Select(p =>
        {
            p.TagIds = TryDeserialize(p.Tags, () => JsonSerializer.Deserialize<List<int>>(p.Tags)) ?? new();
            p.TagNames = p.TagIds.Select(id => tagDict.GetValueOrDefault(id, "")).Where(n => n != "").ToList();
            return new ProfileListItem
            {
                Id = p.Id,
                Name = p.Name,
                GroupId = p.GroupId,
                GroupName = p.GroupName,
                TagIds = p.TagIds,
                TagNames = p.TagNames,
                ProxyId = p.ProxyId,
                ProxyName = p.ProxyName,
                BrowserType = p.BrowserType,
                Notes = p.Notes,
                Status = p.Status,
                CreatedAt = p.CreatedAt,
                LastOpened = p.LastOpened
            };
        }).ToList();

        return new ProfileListResponse { Items = items, Total = items.Count };
    }

    public async Task<ProfileListItem?> GetProfileAsync(int id)
    {
        var p = await _profileRepo.GetByIdAsync(id);
        if (p == null) return null;
        var allTags = await _tagRepo.GetAllAsync();
        var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);
        p.TagIds = TryDeserialize(p.Tags, () => JsonSerializer.Deserialize<List<int>>(p.Tags)) ?? new();
        p.TagNames = p.TagIds.Select(id => tagDict.GetValueOrDefault(id, "")).Where(n => n != "").ToList();
        return new ProfileListItem
        {
            Id = p.Id,
            Name = p.Name,
            GroupId = p.GroupId,
            GroupName = p.GroupName,
            TagIds = p.TagIds,
            TagNames = p.TagNames,
            ProxyId = p.ProxyId,
            ProxyName = p.ProxyName,
            BrowserType = p.BrowserType,
            Notes = p.Notes,
            Status = p.Status,
            CreatedAt = p.CreatedAt,
            LastOpened = p.LastOpened
        };
    }

    public async Task<ProfileListItem> CreateProfileAsync(ProfileCreateRequest req)
    {
        var profile = new Profile
        {
            Name = req.Name,
            GroupId = req.GroupId,
            Tags = JsonSerializer.Serialize(req.TagIds ?? new List<int>()),
            ProxyId = req.ProxyId,
            BrowserType = req.BrowserType,
            ProfileData = req.ProfileData,
            Notes = req.Notes ?? "",
            CreatedAt = DateTime.Now
        };

        var id = await _profileRepo.CreateAsync(profile);
        profile.Id = id;

        _folderService.CreateProfileFolder(id);
        var configJson = _configBuilder.BuildConfigJson(profile);
        _folderService.SaveConfigJson(id, configJson);

        return (await GetProfileAsync(id))!;
    }

    public async Task<ProfileListItem> UpdateProfileAsync(ProfileUpdateRequest req)
    {
        var existing = await _profileRepo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Profile {req.Id} not found");

        existing.Name = req.Name;
        existing.GroupId = req.GroupId;
        existing.Tags = JsonSerializer.Serialize(req.TagIds ?? new List<int>());
        existing.ProxyId = req.ProxyId;
        existing.BrowserType = req.BrowserType;
        existing.ProfileData = req.ProfileData;
        existing.Notes = req.Notes ?? "";

        await _profileRepo.UpdateAsync(existing);

        var configJson = _configBuilder.BuildConfigJson(existing);
        _folderService.SaveConfigJson(existing.Id, configJson);

        return (await GetProfileAsync(existing.Id))!;
    }

    public async Task DeleteProfileAsync(int id)
    {
        _folderService.DeleteProfileFolder(id);
        await _profileRepo.DeleteAsync(id);
    }

    public async Task BulkDeleteAsync(List<int> ids)
    {
        foreach (var id in ids)
            _folderService.DeleteProfileFolder(id);
        await _profileRepo.BulkDeleteAsync(ids);
    }

    public async Task BulkAssignGroupAsync(List<int> ids, int? groupId)
        => await _profileRepo.BulkAssignGroupAsync(ids, groupId);

    public async Task<ProfileListItem> DuplicateProfileAsync(int sourceId, string newName)
    {
        var source = await _profileRepo.GetByIdAsync(sourceId);
        if (source == null) throw new InvalidOperationException($"Profile {sourceId} not found");

        var copy = new Profile
        {
            Name = newName,
            GroupId = source.GroupId,
            Tags = source.Tags,
            ProxyId = source.ProxyId,
            BrowserType = source.BrowserType,
            ProfileData = source.ProfileData,
            Notes = source.Notes,
            CreatedAt = DateTime.Now
        };

        var id = await _profileRepo.CreateAsync(copy);
        copy.Id = id;

        _folderService.CreateProfileFolder(id);
        var configJson = _configBuilder.BuildConfigJson(copy);
        _folderService.SaveConfigJson(id, configJson);

        return (await GetProfileAsync(id))!;
    }

    public async Task UpdateLastOpenedAsync(int id)
        => await _profileRepo.UpdateLastOpenedAsync(id);

    private static T? TryDeserialize<T>(string json, Func<T?> deserializer) where T : class
    {
        try { return deserializer(); }
        catch { return null; }
    }
}
