using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bogus;
using DuckGo.Data.Repositories;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ProfileService
{
    private static readonly JsonSerializerOptions NoScientificNotationOptions = new()
    {
        WriteIndented = false,
        Converters = { new DoubleNoScientificNotationConverter() }
    };

    private readonly IProfileRepository _profileRepo;
    private readonly IGroupRepository _groupRepo;
    private readonly ITagRepository _tagRepo;
    private readonly IProxyRepository _proxyRepo;
    private readonly FingerprintService _fingerprintSvc;

    public ProfileService(
        IProfileRepository profileRepo,
        IGroupRepository groupRepo,
        ITagRepository tagRepo,
        IProxyRepository proxyRepo,
        FingerprintService fingerprintSvc)
    {
        _profileRepo = profileRepo;
        _groupRepo = groupRepo;
        _tagRepo = tagRepo;
        _proxyRepo = proxyRepo;
        _fingerprintSvc = fingerprintSvc;
    }

    public async Task<ProfileListResponse> GetProfilesAsync(
        string? search = null,
        int? id = null,
        int? groupId = null,
        List<int>? tagIds = null,
        string? browserType = null)
    {
        var profiles = await _profileRepo.GetAllAsync(search, id, groupId, tagIds, browserType);
        var allTags = await _tagRepo.GetAllAsync();
        var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);

        var items = profiles.Select(p =>
        {
            p.TagIds = TryDeserialize(p.TagIdsJson, () => JsonSerializer.Deserialize<List<int>>(p.TagIdsJson)) ?? new();
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
                BrowserVersion = p.BrowserVersion,
                Notes = p.Notes,
                Cookies = p.Cookies,
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
        p.TagIds = TryDeserialize(p.TagIdsJson, () => JsonSerializer.Deserialize<List<int>>(p.TagIdsJson)) ?? new();
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
            Cookies = p.Cookies,
            Status = p.Status,
            CreatedAt = p.CreatedAt,
            LastOpened = p.LastOpened
        };
    }

    public async Task<ProfileListItem> CreateProfileAsync(ProfileCreateRequest req)
    {
        var normalizedProxyId = NormalizeProxyId(req.ProxyId, req.Fingerprint?.Proxy);
        var normalizedName = EnsureProfileName(req.Name);
        var normalizedReq = req with { Name = normalizedName, ProxyId = normalizedProxyId };
        string profileData;
        if (!string.IsNullOrWhiteSpace(normalizedReq.ProfileData))
        {
            profileData = normalizedReq.ProfileData;
        }
        else
        {
            var cfg = await _fingerprintSvc.GenerateAsync(
                platform: normalizedReq.Fingerprint?.Platform,
                browserType: normalizedReq.BrowserType,
                osModelName: normalizedReq.Fingerprint?.OSModel,
                screenWidth: normalizedReq.Fingerprint?.ScreenWidth,
                screenHeight: normalizedReq.Fingerprint?.ScreenHeight,
                pixelRatio: normalizedReq.Fingerprint?.ScreenPixelRatio,
                timezone: normalizedReq.Fingerprint?.Timezone,
                languages: normalizedReq.Fingerprint?.Languages,
                webglVendor: normalizedReq.Fingerprint?.WebGLVendor,
                webglRenderer: normalizedReq.Fingerprint?.WebGLRenderer
            );

            ApplyFingerprintOverrides(cfg, normalizedReq);
            profileData = JsonSerializer.Serialize(cfg, NoScientificNotationOptions);
        }

        var profile = new Profile
        {
            Name = normalizedReq.Name,
            GroupId = normalizedReq.GroupId,
            TagIdsJson = JsonSerializer.Serialize(normalizedReq.TagIds ?? new List<int>()),
            ProxyId = normalizedReq.ProxyId,
            BrowserType = normalizedReq.BrowserType,
            BrowserVersion = normalizedReq.Fingerprint?.BrowserVersion ?? "",
            ProfileData = profileData,
            Notes = normalizedReq.Notes ?? "",
            Cookies = normalizedReq.Cookies ?? normalizedReq.CookiesData ?? "[]",
            CreatedAt = DateTime.Now
        };

        var id = await _profileRepo.CreateAsync(profile);
        profile.Id = id;

        var hydrated = HydrateProfileMetadata(profile.ProfileData, profile, normalizedReq.StartUrl);
        profile.ProfileData = JsonSerializer.Serialize(hydrated, NoScientificNotationOptions);
        await _profileRepo.UpdateAsync(profile);

        return (await GetProfileAsync(id))!;
    }

    public async Task<ProfileListItem> UpdateProfileAsync(ProfileUpdateRequest req)
    {
        var existing = await _profileRepo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Profile {req.Id} not found");

        existing.Name = req.Name;
        existing.GroupId = req.GroupId;
        existing.TagIdsJson = JsonSerializer.Serialize(req.TagIds ?? new List<int>());
        existing.ProxyId = req.ProxyId;
        existing.BrowserType = req.BrowserType;
        existing.BrowserVersion = TryDeserialize(req.ProfileData, () => JsonSerializer.Deserialize<ProfileDataConfig>(req.ProfileData))?.System?.BrowserVersion ?? existing.BrowserVersion;
        existing.ProfileData = req.ProfileData;
        existing.Notes = req.Notes ?? "";
        existing.Cookies = req.Cookies ?? "[]";

        await _profileRepo.UpdateAsync(existing);

        return (await GetProfileAsync(existing.Id))!;
    }

    public async Task DeleteProfileAsync(int id)
    {
        await _profileRepo.DeleteAsync(id);
    }

    public async Task BulkDeleteAsync(List<int> ids)
    {
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
            TagIdsJson = source.TagIdsJson,
            ProxyId = source.ProxyId,
            BrowserType = source.BrowserType,
            ProfileData = source.ProfileData,
            Notes = source.Notes,
            Cookies = source.Cookies,
            CreatedAt = DateTime.Now
        };

        var id = await _profileRepo.CreateAsync(copy);
        copy.Id = id;

        return (await GetProfileAsync(id))!;
    }

    public async Task UpdateLastOpenedAsync(int id)
        => await _profileRepo.UpdateLastOpenedAsync(id);

    private static void ApplyFingerprintOverrides(ProfileDataConfig cfg, ProfileCreateRequest req)
    {
        cfg.Profile ??= new ProfileMetadataConfig();
        cfg.System ??= SystemConfig.Default;
        cfg.Fingerprint ??= FingerprintConfig.Default;
        cfg.Location ??= new LocationConfig();
        cfg.Network ??= new NetworkConfig();
        cfg.Security ??= new SecurityConfig();

        cfg.Profile.ProfileName = req.Name;
        cfg.Profile.StartURL = req.StartUrl?.Trim() ?? "";

        var fp = req.Fingerprint;
        if (fp == null)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(fp.Language)) cfg.System.Language = fp.Language;
        // UseRealUserAgent = true means Real mode (browser uses real UA - clear any generated UA)
        if (fp.UseRealUserAgent)
        {
            cfg.System.UserAgent = null;
        }
        else if (!string.IsNullOrWhiteSpace(fp.UserAgent))
        {
            // Custom mode: use the provided UserAgent
            cfg.System.UserAgent = fp.UserAgent;
        }
        // Random mode (UseRealUserAgent=false, UserAgent=null): keep the generated UA from FingerprintService
        if (!string.IsNullOrWhiteSpace(fp.BrowserVersion)) cfg.System.BrowserVersion = fp.BrowserVersion;
        if (!string.IsNullOrWhiteSpace(fp.AcceptLanguage)) cfg.System.AcceptLanguage = fp.AcceptLanguage;
        else if (fp.Languages?.Count > 0) cfg.System.AcceptLanguage = string.Join(",", fp.Languages);

        if (fp.HardwareConcurrency.HasValue) cfg.System.HardwareConcurrency = fp.HardwareConcurrency.Value;
        if (fp.DeviceMemory.HasValue) cfg.System.DeviceMemory = fp.DeviceMemory.Value;
        if (fp.ScreenWidth.HasValue) cfg.System.Screen.Width = fp.ScreenWidth.Value;
        if (fp.ScreenHeight.HasValue) cfg.System.Screen.Height = fp.ScreenHeight.Value;
        if (fp.ScreenPixelRatio.HasValue) cfg.System.Screen.PixelRatio = fp.ScreenPixelRatio.Value;

        if (!string.IsNullOrWhiteSpace(fp.LocationMode)) cfg.Location.Mode = NormalizeMode(fp.LocationMode);
        if (fp.Latitude.HasValue) cfg.Location.Latitude = fp.Latitude.Value;
        if (fp.Longitude.HasValue) cfg.Location.Longitude = fp.Longitude.Value;
        if (fp.Accuracy.HasValue) cfg.Location.Accuracy = fp.Accuracy.Value;

        if (!string.IsNullOrWhiteSpace(fp.WebGLMode)) cfg.Fingerprint.WebGL.Mode = NormalizeMode(fp.WebGLMode);
        if (!string.IsNullOrWhiteSpace(fp.WebGLVendor)) cfg.Fingerprint.WebGL.Vendor = fp.WebGLVendor;
        if (!string.IsNullOrWhiteSpace(fp.WebGLRenderer)) cfg.Fingerprint.WebGL.Renderer = fp.WebGLRenderer;
        if (!string.IsNullOrWhiteSpace(fp.CanvasMode)) cfg.Fingerprint.Canvas.Mode = NormalizeMode(fp.CanvasMode);
        if (!string.IsNullOrWhiteSpace(fp.ClientRectsMode)) cfg.Fingerprint.ClientRects.Mode = NormalizeMode(fp.ClientRectsMode);
        if (!string.IsNullOrWhiteSpace(fp.MediaDevicesMode)) cfg.Fingerprint.MediaDevices.Mode = NormalizeMode(fp.MediaDevicesMode);
        if (!string.IsNullOrWhiteSpace(fp.DoNotTrack))
        {
            cfg.Fingerprint.DoNotTrack = fp.DoNotTrack switch
            {
                "enabled" => "1",
                "disabled" => "0",
                _ => null
            };
        }
        if (fp.Fonts?.Count > 0) cfg.Fingerprint.Fonts = fp.Fonts;

        if (fp.Proxy is { Mode: not null } proxy)
        {
            var proxyMode = proxy.Mode.Trim().ToLowerInvariant();
            if (proxyMode == "custom" && !string.IsNullOrWhiteSpace(proxy.Host))
            {
                cfg.Network.Proxy = new ProxyConfig
                {
                    Mode = "custom",
                    SavedProxyId = null,
                    Type = NormalizeProxyType(proxy.Type),
                    Host = proxy.Host ?? "",
                    Port = proxy.Port ?? 0,
                    Username = proxy.Username ?? "",
                    Password = proxy.Password ?? ""
                };
            }
            else if (proxyMode == "saved" && proxy.SavedProxyId.HasValue)
            {
                cfg.Network.Proxy = new ProxyConfig
                {
                    Mode = "saved",
                    SavedProxyId = proxy.SavedProxyId,
                    Type = NormalizeProxyType(proxy.Type),
                    Host = "",
                    Port = 0,
                    Username = "",
                    Password = ""
                };
            }
            else
            {
                cfg.Network.Proxy = null;
            }
        }
        else
        {
            cfg.Network.Proxy = null;
        }

        if (!string.IsNullOrWhiteSpace(fp.PortBlockMode)) cfg.Security.PortBlockMode = fp.PortBlockMode;
        cfg.Security.PortBlockList = fp.PortBlockList ?? new List<string>();
    }

    private static ProfileDataConfig HydrateProfileMetadata(string profileData, Profile profile, string? startUrl)
    {
        var cfg = TryDeserialize(profileData, () => JsonSerializer.Deserialize<ProfileDataConfig>(profileData)) ?? ProfileDataConfig.Default;
        cfg.Profile ??= new ProfileMetadataConfig();
        cfg.Profile.ProfileID = profile.Id.ToString();
        cfg.Profile.ProfileName = profile.Name;
        cfg.Profile.StartURL = startUrl?.Trim() ?? cfg.Profile.StartURL ?? "";

        return cfg;
    }

    private static string NormalizeMode(string mode)
    {
        return mode switch
        {
            "real" => "Real",
            "noise" => "Noise",
            "custom" => "Custom",
            _ => mode
        };
    }

    private static string EnsureProfileName(string? name)
    {
        if (!string.IsNullOrWhiteSpace(name)) return name.Trim();

        var faker = new Faker();
        var firstName = faker.Name.FirstName();
        var lastName = faker.Name.LastName();
        var suffix = faker.Random.Number(10, 9999);
        return $"{firstName} {lastName} {suffix}";
    }

    private static int? NormalizeProxyId(int? requestProxyId, ProfileProxyOptions? proxy)
    {
        if (proxy == null) return requestProxyId;

        var mode = (proxy.Mode ?? "").Trim().ToLowerInvariant();
        if (mode == "saved") return proxy.SavedProxyId ?? requestProxyId;
        if (mode == "custom" || mode == "none") return null;

        return requestProxyId;
    }

    private static string NormalizeProxyType(string? type)
    {
        return (type ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "https" => "https",
            "socks4" => "socks4",
            "socks5" => "socks5",
            _ => "http"
        };
    }

    private static string ExtractPart(string? auth, int index)
    {
        if (string.IsNullOrWhiteSpace(auth) || !auth.Contains(':')) return "";
        var parts = auth.Split(':');
        return parts.Length > index ? parts[index] : "";
    }

    private static T? TryDeserialize<T>(string json, Func<T?> deserializer) where T : class
    {
        try { return deserializer(); }
        catch { return null; }
    }

    private class DoubleNoScientificNotationConverter : JsonConverter<double>
    {
        public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => reader.GetDouble();

        public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
        {
            if (Math.Abs(value) < 1e-15)
                writer.WriteNumberValue(0);
            else
                writer.WriteNumberValue(value);
        }
    }
}
