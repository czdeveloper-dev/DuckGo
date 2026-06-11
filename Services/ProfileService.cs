using System.Globalization;
using System.IO;
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
        PropertyNameCaseInsensitive = true,
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
        string? idStr = null,
        int? groupId = null,
        List<int>? tagIds = null,
        string? browserType = null,
        string? status = null)
    {
        var profiles = await _profileRepo.GetAllAsync(search, idStr, groupId, tagIds, browserType);
        var allTags = await _tagRepo.GetAllAsync();
        var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);

        var items = profiles.Select(p =>
        {
            p.TagIds = TryDeserialize(p.TagIdsJson, () => JsonSerializer.Deserialize<List<int>>(p.TagIdsJson)) ?? new();
            p.TagNames = p.TagIds.Select(id => tagDict.GetValueOrDefault(id, "")).Where(n => n != "").ToList();

            string platform = "Windows";
            string? customProxyName = null;
            if (!string.IsNullOrEmpty(p.ProfileData))
            {
                if (p.ProfileData.Contains("\"MacIntel\"") || p.ProfileData.Contains("\"Darwin\"") || p.ProfileData.Contains("\"macOS\"")) platform = "MacOS";
                else if (p.ProfileData.Contains("\"Linux")) platform = "Linux";

                if (!p.ProxyId.HasValue && p.ProfileData.Contains("\"Network\"") && p.ProfileData.Contains("\"custom\""))
                {
                    try {
                        var doc = System.Text.Json.JsonDocument.Parse(p.ProfileData);
                        if (doc.RootElement.TryGetProperty("Network", out var net) &&
                            net.TryGetProperty("Proxy", out var proxy) &&
                            proxy.TryGetProperty("Mode", out var mode) && mode.GetString() == "custom")
                        {
                            var type = proxy.TryGetProperty("Type", out var t) ? t.GetString() : "http";
                            var host = proxy.TryGetProperty("Host", out var h) ? h.GetString() : "";
                            
                            int port = 0;
                            if (proxy.TryGetProperty("Port", out var pt))
                            {
                                if (pt.ValueKind == System.Text.Json.JsonValueKind.Number) port = pt.GetInt32();
                                else if (pt.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(pt.GetString(), out int parsedPort)) port = parsedPort;
                            }
                            
                            if (!string.IsNullOrEmpty(host))
                            {
                                customProxyName = $"{type}://{host}:{port}";
                            }
                        }
                    } catch {}
                }
            }

            var realStatus = ProfileStatusService.GetStatus(p.Id);
            var realMessage = ProfileStatusService.GetMessage(p.Id);
            if (string.IsNullOrEmpty(realMessage)) realMessage = p.Message;

            return new ProfileListItem
            {
                Id = p.Id,
                Name = p.Name,
                GroupId = p.GroupId,
                GroupName = p.GroupName,
                TagIds = p.TagIds,
                TagNames = p.TagNames,
                ProxyId = p.ProxyId,
                ProxyName = p.ProxyName ?? customProxyName,
                BrowserType = p.BrowserType,
                BrowserVersion = p.BrowserVersion,
                Platform = platform,
                Notes = p.Notes,
                Cookies = p.Cookies,
                Status = realStatus,
                CreatedAt = p.CreatedAt,
                LastOpened = p.LastOpened,
                Message = realMessage
            };
        }).ToList();

        if (!string.IsNullOrEmpty(status))
        {
            var st = status.ToLowerInvariant();
            items = items.Where(i => i.Status?.ToLowerInvariant() == st).ToList();
        }

        return new ProfileListResponse
        {
            Total = items.Count,
            Items = items
        };
    }

        public async Task<ProfileDetailItem?> GetProfileAsync(int id)
        {
            var p = await _profileRepo.GetByIdAsync(id);
            if (p == null) return null;
            
            var allTags = await _tagRepo.GetAllAsync();
            var tagDict = allTags.ToDictionary(t => t.Id, t => t.Name);
            p.TagIds = TryDeserialize(p.TagIdsJson, () => JsonSerializer.Deserialize<List<int>>(p.TagIdsJson)) ?? new();
            p.TagNames = p.TagIds.Select(id => tagDict.GetValueOrDefault(id, "")).Where(n => n != "").ToList();
            
            // Ensure ProfileData is never null - use empty object if not set
            var profileData = string.IsNullOrWhiteSpace(p.ProfileData) ? "{}" : p.ProfileData;
            
            // MIGRATION: Copy Profile.BrowserVersion to SystemConfig.BrowserVersion if SystemConfig doesn't have it
            // This ensures backward compatibility with old profiles that store BrowserVersion at the entity level
            if (!string.IsNullOrWhiteSpace(p.BrowserVersion))
            {
                profileData = MigrateBrowserVersion(profileData, p.BrowserVersion);
            }
            
            var result = new ProfileDetailItem
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
                ProfileData = profileData,
                Notes = p.Notes,
                Cookies = p.Cookies,
                Status = p.Status,
                Message = p.Message,
                CreatedAt = p.CreatedAt,
                LastOpened = p.LastOpened
            };
            
            return result;
        }

    public async Task<ProfileDetailItem> CreateProfileAsync(ProfileCreateRequest req)
    {
        Console.WriteLine("[ProfileService.CreateAsync] START");
        var normalizedProxyId = NormalizeProxyId(req.ProxyId, req.Fingerprint?.Proxy);
        Console.WriteLine("[ProfileService.CreateAsync] proxy normalized");
        var normalizedName = EnsureProfileName(req.Name);
        var normalizedReq = req with { Name = normalizedName, ProxyId = normalizedProxyId };
        Console.WriteLine("[ProfileService.CreateAsync] name normalized");
        string profileData;
        if (!string.IsNullOrWhiteSpace(normalizedReq.ProfileData))
        {
            profileData = normalizedReq.ProfileData;
        }
        else
        {
            Console.WriteLine("[ProfileService.CreateAsync] calling GenerateAsync");
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
            Console.WriteLine("[ProfileService.CreateAsync] GenerateAsync done, calling ApplyFingerprintOverridesAsync");

            await ApplyFingerprintOverridesAsync(cfg, normalizedReq);
            Console.WriteLine("[ProfileService.CreateAsync] ApplyFingerprintOverridesAsync done");
            profileData = SerializeProfileData(cfg);
            Console.WriteLine("[ProfileService.CreateAsync] SerializeProfileData done, profileData length=" + profileData.Length);
        }

        Console.WriteLine("[ProfileService.CreateAsync] creating Profile object");
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

        Console.WriteLine("[ProfileService.CreateAsync] calling _profileRepo.CreateAsync");
        var id = await _profileRepo.CreateAsync(profile);
        Console.WriteLine("[ProfileService.CreateAsync] CreateAsync done, id=" + id);
        profile.Id = id;

        var hydrated = HydrateProfileMetadata(profile.ProfileData, profile, normalizedReq.StartUrl);
        profile.ProfileData = SerializeProfileData(hydrated);
        await _profileRepo.UpdateAsync(profile);

        Console.WriteLine("[ProfileService.CreateAsync] returning GetProfileAsync(id=" + id + ")");
        return (await GetProfileAsync(id))!;
    }

    public async Task<ProfileDetailItem> UpdateProfileAsync(ProfileUpdateRequest req)
    {
        var existing = await _profileRepo.GetByIdAsync(req.Id);
        if (existing == null) throw new InvalidOperationException($"Profile {req.Id} not found");

        existing.Name = req.Name;
        existing.GroupId = req.GroupId;
        existing.TagIdsJson = JsonSerializer.Serialize(req.TagIds ?? new List<int>());
        existing.ProxyId = req.ProxyId;
        existing.BrowserType = req.BrowserType;
        existing.BrowserVersion = req.BrowserVersion ?? existing.BrowserVersion;

        var normalizedProfileData = NormalizeProfileData(req.ProfileData, existing, req.BrowserVersion);
        existing.ProfileData = SerializeProfileData(normalizedProfileData);

        existing.Notes = req.Notes ?? "";
        existing.Cookies = req.Cookies ?? "[]";

        await _profileRepo.UpdateAsync(existing);

        var result = await GetProfileAsync(existing.Id);
        Console.WriteLine($"[ProfileService.UpdateProfileAsync] Returning ProfileDetailItem with ProfileData length={result?.ProfileData?.Length ?? 0}");
        return result!;
    }

    public async Task UpdateProfileBrowserVersionAsync(int id, string browserVersion, bool autoUpdateUA)
    {
        var existing = await _profileRepo.GetByIdAsync(id);
        if (existing == null) throw new InvalidOperationException($"Profile {id} not found.");

        existing.BrowserVersion = browserVersion;

        var profileData = existing.ProfileData ?? "{}";
        var cfg = TryDeserialize(profileData, () => JsonSerializer.Deserialize<ProfileDataConfig>(profileData, NoScientificNotationOptions)) ?? new ProfileDataConfig();
        cfg.System ??= SystemConfig.Default;
        cfg.System.BrowserVersion = browserVersion;

        if (autoUpdateUA)
        {
            var newFp = await _fingerprintSvc.GenerateAsync(
                platform: cfg.System.Platform?.Value,
                browserType: existing.BrowserType
            );
            if (newFp.System?.UserAgent != null)
            {
                cfg.System.UserAgent = newFp.System.UserAgent;
            }
        }

        existing.ProfileData = SerializeProfileData(cfg);
        await _profileRepo.UpdateAsync(existing);
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

    public async Task<ProfileDetailItem> DuplicateProfileAsync(int sourceId, string newName)
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

        var result = await GetProfileAsync(id);
        Console.WriteLine($"[ProfileService.DuplicateProfileAsync] Returning ProfileDetailItem with ProfileData length={result?.ProfileData?.Length ?? 0}");
        return result!;
    }

    public async Task UpdateLastOpenedAsync(int id)
        => await _profileRepo.UpdateLastOpenedAsync(id);

    public object DetectScreen()
    {
        return new
        {
            width = System.Windows.SystemParameters.PrimaryScreenWidth,
            height = System.Windows.SystemParameters.PrimaryScreenHeight,
            workAreaWidth = System.Windows.SystemParameters.WorkArea.Width,
            workAreaHeight = System.Windows.SystemParameters.WorkArea.Height,
            virtualScreenLeft = System.Windows.SystemParameters.VirtualScreenLeft,
            virtualScreenTop = System.Windows.SystemParameters.VirtualScreenTop,
            virtualScreenWidth = System.Windows.SystemParameters.VirtualScreenWidth,
            virtualScreenHeight = System.Windows.SystemParameters.VirtualScreenHeight
        };
    }

    private async Task ApplyFingerprintOverridesAsync(ProfileDataConfig cfg, ProfileCreateRequest req)
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
        if (fp == null) return;

        // ── System fields: wrapped in TypedConfig<*>
        // Language: full list from FE → Language.Value = comma-joined string (AcceptLanguage is removed, same purpose).
        // Empty/null → real (use browser's real language).
        if (fp.Languages?.Count > 0)
        {
            var langsStr = string.Join(",", fp.Languages);
            cfg.System.Language = new TypedConfig<string>("noise", langsStr);
        }
        else if (!string.IsNullOrWhiteSpace(fp.Language))
        {
            cfg.System.Language = new TypedConfig<string>("noise", fp.Language);
        }
        else
        {
            cfg.System.Language = new TypedConfig<string>("real", null);
        }

        // AcceptLanguage is deprecated — same purpose as Language. No-op to preserve old profiles.

        // Timezone: null/empty means Auto (Real mode → no spoof); only noise when user picks a specific TZ
        if (!string.IsNullOrWhiteSpace(fp.Timezone))
            cfg.System.Timezone = new TypedConfig<string>("noise", fp.Timezone);
        else
            cfg.System.Timezone = new TypedConfig<string>("real", null);

        if (!string.IsNullOrWhiteSpace(fp.BrowserVersion))
            cfg.System.BrowserVersion = fp.BrowserVersion;

        // UserAgent: "real" (null Value), "noise" (custom UA), "random" (browser-generated from template).
        // UseRealUserAgent=true → real mode.
        // UseRealUserAgent=false + explicit UserAgent string → noise mode with explicit Value.
        // UseRealUserAgent=false + uaMode="random" → keep generated noise value from GenerateAsync.
        // UseRealUserAgent=false + uaMode="real" → override to real.
        // UseRealUserAgent=false + no UA and no mode → override to real.
        if (fp.UseRealUserAgent)
        {
            cfg.System.UserAgent = new TypedConfig<string>("real", null);
        }
        else if (!string.IsNullOrWhiteSpace(fp.UserAgent))
        {
            cfg.System.UserAgent = new TypedConfig<string>("noise", fp.UserAgent);
        }
        else if (!string.IsNullOrWhiteSpace(fp.UaMode))
        {
            var uaModeLower = fp.UaMode.Trim().ToLowerInvariant();
            if (uaModeLower == "random")
            {
                // do nothing — keep generated noise+UA from GenerateAsync
            }
            else
            {
                cfg.System.UserAgent = new TypedConfig<string>(NormalizeMode(fp.UaMode), null);
            }
        }
        else
        {
            cfg.System.UserAgent = new TypedConfig<string>("real", null);
        }

        // Hardware: HardwareConcurrency/DeviceMemory.
        // Real mode (cpuMode="real" or null/empty): Mode=real, Value=null.
        // Spoof mode (cpuMode="random"/"noise"/"custom"): keep template values from GenerateAsync.
        // Explicit HardwareConcurrency/DeviceMemory value from FE: always apply with hwMode.
        var hwMode = NormalizeFingerprintMode(fp.CpuMode);

        if (hwMode == "real")
        {
            // Override to real,null — user wants no spoof
            cfg.System.HardwareConcurrency = new TypedConfig<int?> { Mode = "real", Value = null };
            cfg.System.DeviceMemory = new TypedConfig<int?> { Mode = "real", Value = null };
        }
        else if (fp.HardwareConcurrency is > 0 || fp.DeviceMemory is > 0)
        {
            // Explicit user values: apply with spoof mode
            if (fp.HardwareConcurrency is > 0)
                cfg.System.HardwareConcurrency = new TypedConfig<int?>(hwMode ?? "noise", fp.HardwareConcurrency.Value);
            if (fp.DeviceMemory is > 0)
                cfg.System.DeviceMemory = new TypedConfig<int?>(hwMode ?? "noise", fp.DeviceMemory.Value);
        }
        // else: spoof mode with no explicit values → keep template values from GenerateAsync

        // Architecture & Bitness — same logic: only override when cpuMode="real"
        var archMode = NormalizeFingerprintMode(fp.CpuMode);
        if (archMode == "real")
        {
            cfg.System.Architecture = new TypedConfig<string>("real", null);
            cfg.System.Bitness = new TypedConfig<string>("real", null);
        }
        // else: spoof mode → keep template values from GenerateAsync

        // Screen: Real mode → Width/Height/PixelRatio = null (no spoof). Only set when user selects Custom.
        var screenMode = NormalizeFingerprintMode(fp.ScreenMode);
        cfg.System.Screen.Mode = screenMode ?? "real";
        if (screenMode != null && screenMode != "real")
        {
            if (fp.ScreenWidth.HasValue) cfg.System.Screen.Width = fp.ScreenWidth.Value;
            if (fp.ScreenHeight.HasValue) cfg.System.Screen.Height = fp.ScreenHeight.Value;
            if (fp.ScreenPixelRatio.HasValue) cfg.System.Screen.PixelRatio = fp.ScreenPixelRatio.Value;
            cfg.System.Screen.ColorDepth = 24; // only set ColorDepth when spoofing
        }
        else
        {
            cfg.System.Screen.Width = null;
            cfg.System.Screen.Height = null;
            cfg.System.Screen.PixelRatio = null;
            cfg.System.Screen.ColorDepth = null;
        }

        // Location:
        // - real: block geolocation, null coordinates.
        // - noise: get real IP geolocation, randomize slightly. Access=allow, real coordinates.
        // - custom: treat as noise, use FE coordinates if provided, otherwise get real IP location.
        var locationMode2 = NormalizeFingerprintMode(fp.LocationMode);

        if (locationMode2 == "real")
        {
            cfg.Location.Mode = "real";
            cfg.Location.Access = "block";
            cfg.Location.Latitude = null;
            cfg.Location.Longitude = null;
            cfg.Location.Accuracy = null;
        }
        else if (locationMode2 == "custom")
        {
            // "custom" in FE means user wants explicit location. Treat as noise.
            cfg.Location.Mode = "noise";
            cfg.Location.Access = "allow";
            if (fp.Latitude.HasValue && fp.Longitude.HasValue)
            {
                cfg.Location.Latitude = fp.Latitude.Value;
                cfg.Location.Longitude = fp.Longitude.Value;
                cfg.Location.Accuracy = fp.Accuracy ?? 100;
            }
            else
            {
                var (lat, lng) = await _fingerprintSvc.GetRealLocationAsync(fp.Timezone ?? "UTC");
                cfg.Location.Latitude = lat;
                cfg.Location.Longitude = lng;
                cfg.Location.Accuracy = Random.Shared.Next(50, 500);
            }
        }
        else
        {
            // "noise" or any other spoof mode: get real IP geolocation.
            cfg.Location.Mode = "noise";
            cfg.Location.Access = "allow";
            var (lat, lng) = await _fingerprintSvc.GetRealLocationAsync(fp.Timezone ?? "UTC");
            cfg.Location.Latitude = lat;
            cfg.Location.Longitude = lng;
            cfg.Location.Accuracy = Random.Shared.Next(50, 500);
        }

        // ── Fingerprint groups
        var webglMode = NormalizeFingerprintMode(fp.WebGLMode);
        cfg.Fingerprint.WebGL.Mode = webglMode;
        if (webglMode == "real")
        {
            cfg.Fingerprint.WebGL.Vendor = null;
            cfg.Fingerprint.WebGL.Renderer = null;
            cfg.Fingerprint.WebGL.NoiseSeed = null;
            cfg.Fingerprint.WebGL.NoiseLevel = null;
            if (cfg.Fingerprint.WebGL.ImageSpoofing != null)
            {
                cfg.Fingerprint.WebGL.ImageSpoofing.Mode = "real";
                cfg.Fingerprint.WebGL.ImageSpoofing.TextureSeed = null;
            }
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(fp.WebGLVendor)) cfg.Fingerprint.WebGL.Vendor = fp.WebGLVendor;
            if (!string.IsNullOrWhiteSpace(fp.WebGLRenderer)) cfg.Fingerprint.WebGL.Renderer = fp.WebGLRenderer;
            if (cfg.Fingerprint.WebGL.ImageSpoofing != null)
            {
                // FE now sends webglImageMode = "default" | "noise" | "solid" (pattern values).
                // "default" = gradient, no noise; "noise"/"solid" = randomize texture → generate seed.
                var imgPattern = NormalizeFingerprintMode(fp.WebGLImageMode)
                    ?? "default";

                cfg.Fingerprint.WebGL.ImageSpoofing.Mode = "noise"; // always noise when spoofing
                cfg.Fingerprint.WebGL.ImageSpoofing.Pattern = imgPattern;
                cfg.Fingerprint.WebGL.ImageSpoofing.TextureSeed =
                    (imgPattern == "noise" || imgPattern == "solid")
                        ? Guid.NewGuid().ToString("N")[..12]
                        : null;
            }
        }

        // Canvas
        cfg.Fingerprint.Canvas.Mode = NormalizeFingerprintMode(fp.CanvasMode);
        // Real mode: null NoiseSeed/NoiseLevel (browser uses real canvas)
        // Non-Real: preserve generated seeds (from GenerateAsync) or allow override
        if (cfg.Fingerprint.Canvas.Mode == "real")
        {
            cfg.Fingerprint.Canvas.NoiseSeed = null;
            cfg.Fingerprint.Canvas.NoiseLevel = null;
        }
        // If user explicitly selected a mode, ensure it's applied even if GenerateAsync set different
        else if (!string.IsNullOrWhiteSpace(fp.CanvasMode))
        {
            // Mode already set above; seeds from GenerateAsync are preserved
        }

        // ClientRects
        cfg.Fingerprint.ClientRects.Mode = NormalizeFingerprintMode(fp.ClientRectsMode);
        if (cfg.Fingerprint.ClientRects.Mode == "real")
        {
            cfg.Fingerprint.ClientRects.NoiseSeed = null;
            cfg.Fingerprint.ClientRects.NoiseLevel = null;
        }

        // MediaDevices
        cfg.Fingerprint.MediaDevices.Mode = NormalizeFingerprintMode(fp.MediaDevicesMode);
        if (cfg.Fingerprint.MediaDevices.Mode == "real")
        {
            cfg.Fingerprint.MediaDevices.VideoInputs = null;
            cfg.Fingerprint.MediaDevices.AudioInputs = null;
            cfg.Fingerprint.MediaDevices.AudioOutputs = null;
        }

        // Plugins: now an object with .Mode
        cfg.Fingerprint.Plugins ??= new PluginsConfig();
        cfg.Fingerprint.Plugins.Mode = NormalizeFingerprintMode(fp.PluginsMode);
        if (cfg.Fingerprint.Plugins.Mode == "real")
        {
            cfg.Fingerprint.Plugins.PluginList = new List<PluginInfo>();
        }

        // Fonts: now an object with .Mode
        cfg.Fingerprint.Fonts ??= new FontsConfig();
        var fontsMode = NormalizeFingerprintMode(fp.FontsMode);
        cfg.Fingerprint.Fonts.Mode = fontsMode ?? "real";
        
        if (fontsMode == "real")
        {
            cfg.Fingerprint.Fonts.FontList = new List<string>();
        }
        else if (fp.Fonts != null && fp.Fonts.Count > 0)
        {
            cfg.Fingerprint.Fonts.FontList = fp.Fonts;
        }

        // Audio
        cfg.Fingerprint.Audio.Mode = NormalizeFingerprintMode(fp.AudioMode);
        if (cfg.Fingerprint.Audio.Mode == "real")
        {
            cfg.Fingerprint.Audio.NoiseSeed = null;
            cfg.Fingerprint.Audio.NoiseLevel = null;
        }

        // FontMetrics
        cfg.Fingerprint.FontMetrics ??= new FontMetricsConfig();
        cfg.Fingerprint.FontMetrics.Mode = NormalizeFingerprintMode(fp.FontMetricsMode);
        if (cfg.Fingerprint.FontMetrics.Mode == "real")
        {
            cfg.Fingerprint.FontMetrics.NoiseSeed = null;
            cfg.Fingerprint.FontMetrics.NoiseLevel = null;
        }
        else if (!string.IsNullOrWhiteSpace(fp.FontMetricsMode) &&
                 fp.FontMetricsMode.Trim().ToLowerInvariant() == "noise")
        {
            if (!string.IsNullOrWhiteSpace(fp.FontMetricsNoiseSeed))
                cfg.Fingerprint.FontMetrics.NoiseSeed = fp.FontMetricsNoiseSeed;
            if (fp.FontMetricsNoiseLevel.HasValue)
                cfg.Fingerprint.FontMetrics.NoiseLevel = fp.FontMetricsNoiseLevel.Value;
        }

        // SSL, Speech, WebRTC — simple string modes (no config object)
        cfg.Fingerprint.SslMode = NormalizeFingerprintMode(fp.SslMode) ?? "noise";
        cfg.Fingerprint.SpeechVoicesMode = NormalizeFingerprintMode(fp.SpeechVoicesMode) ?? "noise";
        cfg.Fingerprint.WebRTcMode = NormalizeFingerprintMode(fp.WebRtcMode) ?? "disable";

        // DoNotTrack: "enabled" → Mode=noise, Value="1"; "disabled" → Mode=noise, Value="0"; null/empty → Mode=real, Value=null
        cfg.Fingerprint.DoNotTrack ??= new DoNotTrackConfig();
        if (!string.IsNullOrWhiteSpace(fp.DoNotTrack))
        {
            cfg.Fingerprint.DoNotTrack.Mode = fp.DoNotTrack switch
            {
                "enabled" => "noise",
                "disabled" => "noise",
                _ => "real"
            };
            cfg.Fingerprint.DoNotTrack.Value = fp.DoNotTrack switch
            {
                "enabled" => "1",
                "disabled" => "0",
                _ => null
            };
        }
        else
        {
            cfg.Fingerprint.DoNotTrack.Mode = "real";
            cfg.Fingerprint.DoNotTrack.Value = null;
        }

        // Network proxy
        if (fp.Proxy is { Mode: not null } proxy)
        {
            var proxyMode = proxy.Mode.Trim().ToLowerInvariant();
            if (proxyMode == "custom" && !string.IsNullOrWhiteSpace(proxy.Host))
            {
                cfg.Network.Proxy = new ProxyConfig
                {
                    Mode = "custom",
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
        var cfg = TryDeserialize(profileData, () => JsonSerializer.Deserialize<ProfileDataConfig>(profileData, NoScientificNotationOptions)) ?? ProfileDataConfig.Default;
        cfg.Profile ??= new ProfileMetadataConfig();
        cfg.Profile.ProfileID = profile.Id.ToString();
        cfg.Profile.ProfileName = profile.Name;
        cfg.Profile.StartURL = startUrl?.Trim() ?? cfg.Profile.StartURL ?? "";

        EnsureSeedsGenerated(cfg);

        return cfg;
    }

    private static ProfileDataConfig NormalizeProfileData(string profileData, Profile profile, string? browserVersion)
    {
        var cfg = TryDeserialize(profileData, () => JsonSerializer.Deserialize<ProfileDataConfig>(profileData, NoScientificNotationOptions));
        if (cfg == null)
        {
            throw new InvalidOperationException("ProfileData is invalid JSON or does not match the expected schema.");
        }

        cfg.Profile ??= new ProfileMetadataConfig();
        cfg.System ??= SystemConfig.Default;
        cfg.System.Screen ??= new ScreenConfig();
        cfg.Fingerprint ??= FingerprintConfig.Default;
        cfg.Fingerprint.WebGL ??= new WebGLConfig();
        cfg.Fingerprint.Canvas ??= new CanvasConfig();
        cfg.Fingerprint.Audio ??= new AudioConfig();
        cfg.Fingerprint.FontMetrics ??= new FontMetricsConfig();
        cfg.Fingerprint.ClientRects ??= new ClientRectsConfig();
        cfg.Fingerprint.MediaDevices ??= new MediaDevicesConfig();
        cfg.Fingerprint.Connection ??= new ConnectionConfig();
        cfg.Fingerprint.Fonts ??= new FontsConfig();
        cfg.Fingerprint.Plugins ??= new PluginsConfig();
        cfg.Fingerprint.StorageQuota ??= new TypedConfig<long?>();
        cfg.Fingerprint.TLSOSMatch ??= new TypedConfig<string>();
        cfg.Fingerprint.DoNotTrack ??= new DoNotTrackConfig();
        cfg.Network ??= new NetworkConfig();
        cfg.Security ??= new SecurityConfig();
        cfg.Location ??= LocationConfig.Default;

        cfg.Profile.ProfileID = profile.Id.ToString();
        cfg.Profile.ProfileName = profile.Name;
        cfg.Profile.StartURL ??= "";

        // MIGRATION: old schema (string fields) → new schema (TypedConfig objects)
        MigrateRealModes(cfg);

        cfg.Security.PortBlockMode ??= "block_default";
        cfg.Security.PortBlockList ??= new List<string>();

        EnsureSeedsGenerated(cfg);

        return cfg;
    }

    private static void EnsureSeedsGenerated(ProfileDataConfig cfg)
    {
        if (cfg.Fingerprint.Canvas.Mode != "real")
        {
            cfg.Fingerprint.Canvas.NoiseSeed ??= Guid.NewGuid().ToString("N")[..12];
            cfg.Fingerprint.Canvas.NoiseLevel ??= 0.00008;
        }
        if (cfg.Fingerprint.Audio.Mode != "real")
        {
            cfg.Fingerprint.Audio.NoiseSeed ??= Guid.NewGuid().ToString("N")[..12];
            cfg.Fingerprint.Audio.NoiseLevel ??= 0.000001;
        }
        if (cfg.Fingerprint.FontMetrics.Mode != "real")
        {
            cfg.Fingerprint.FontMetrics.NoiseSeed ??= Guid.NewGuid().ToString("N")[..12];
            cfg.Fingerprint.FontMetrics.NoiseLevel ??= 0.0001;
        }
        if (cfg.Fingerprint.ClientRects.Mode != "real")
        {
            cfg.Fingerprint.ClientRects.NoiseSeed ??= Guid.NewGuid().ToString("N")[..12];
            cfg.Fingerprint.ClientRects.NoiseLevel ??= 0.000025;
        }
        if (cfg.Fingerprint.WebGL.Mode != "real")
        {
            cfg.Fingerprint.WebGL.NoiseSeed ??= Guid.NewGuid().ToString("N")[..12];
            cfg.Fingerprint.WebGL.NoiseLevel ??= 0.0001;
        }
        if (cfg.Fingerprint.WebGL.ImageSpoofing?.Mode != "real")
        {
            if (cfg.Fingerprint.WebGL.ImageSpoofing != null)
                cfg.Fingerprint.WebGL.ImageSpoofing.TextureSeed ??= Guid.NewGuid().ToString("N")[..12];
        }
    }

    private static string? NormalizeMode(string? mode) => ModeNormalizer.UiToStorage(mode);

    private static string? NormalizeFingerprintMode(string? mode) => ModeNormalizer.ToFingerprintStorage(mode);

    /// <summary>
    /// Migrate old profile data to new schema:
    /// - String fields (Language, Platform...) → TypedConfig objects
    /// - null modes → "real"
    /// - Plugins/Fonts as simple lists → PluginsConfig/FontsConfig objects
    /// - StorageQuota/TLSOSMatch as scalar → TypedConfig
    /// - DoNotTrack as string → DoNotTrackConfig
    /// </summary>
    private static void MigrateRealModes(ProfileDataConfig cfg)
    {
        // Helper: check if a field already has Value property (new schema TypedConfig)
        // If so, skip migration for that field.

        // ── System TypedConfig migration
        // Language
        if (cfg.System.Language?.Value is string langStr)
        {
            // Already new schema
        }
        else if (cfg.System.Language?.Value == null && cfg.System.Language?.Mode == null)
        {
            // Old schema: Language was a string → Value is null, need to migrate
            cfg.System.Language = new TypedConfig<string>("real", null);
        }
        else if (cfg.System.Language == null)
        {
            cfg.System.Language = new TypedConfig<string>("real", null);
        }
        // If Language has Mode set, it's already migrated → do nothing

        // Platform
        if (cfg.System.Platform?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.Platform?.Value == null && cfg.System.Platform?.Mode == null)
        {
            cfg.System.Platform = new TypedConfig<string>("real", null);
        }
        else if (cfg.System.Platform == null)
        {
            cfg.System.Platform = new TypedConfig<string>("real", null);
        }

        // UserAgent: migrate old string format
        if (cfg.System.UserAgent?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.UserAgent?.Value == null && cfg.System.UserAgent?.Mode == null)
        {
            cfg.System.UserAgent = new TypedConfig<string>("real", null);
        }
        else if (cfg.System.UserAgent == null)
        {
            cfg.System.UserAgent = new TypedConfig<string>("real", null);
        }

        // AcceptLanguage
        if (cfg.System.AcceptLanguage?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.AcceptLanguage?.Value == null && cfg.System.AcceptLanguage?.Mode == null)
        {
            cfg.System.AcceptLanguage = new TypedConfig<string>("real", null);
        }
        else if (cfg.System.AcceptLanguage == null)
        {
            cfg.System.AcceptLanguage = new TypedConfig<string>("real", null);
        }

        // Timezone
        if (cfg.System.Timezone?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.Timezone?.Value == null && cfg.System.Timezone?.Mode == null)
        {
            cfg.System.Timezone = new TypedConfig<string>("real", null);
        }
        else if (cfg.System.Timezone == null)
        {
            cfg.System.Timezone = new TypedConfig<string>("real", null);
        }

        // HardwareConcurrency
        if (cfg.System.HardwareConcurrency?.Value is int)
        {
            // new schema
        }
        else if (cfg.System.HardwareConcurrency?.Value == null && cfg.System.HardwareConcurrency?.Mode == null)
        {
            cfg.System.HardwareConcurrency = new TypedConfig<int?> { Mode = "real", Value = null };
        }
        else if (cfg.System.HardwareConcurrency == null)
        {
            cfg.System.HardwareConcurrency = new TypedConfig<int?> { Mode = "real", Value = null };
        }

        // DeviceMemory
        if (cfg.System.DeviceMemory?.Value is int)
        {
            // new schema
        }
        else if (cfg.System.DeviceMemory?.Value == null && cfg.System.DeviceMemory?.Mode == null)
        {
            cfg.System.DeviceMemory = new TypedConfig<int?> { Mode = "real", Value = null };
        }
        else if (cfg.System.DeviceMemory == null)
        {
            cfg.System.DeviceMemory = new TypedConfig<int?> { Mode = "real", Value = null };
        }

        // Architecture
        if (cfg.System.Architecture?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.Architecture?.Value == null && cfg.System.Architecture?.Mode == null)
        {
            cfg.System.Architecture = new TypedConfig<string> { Mode = "real" };
        }
        else if (cfg.System.Architecture == null)
        {
            cfg.System.Architecture = new TypedConfig<string> { Mode = "real" };
        }

        // Bitness
        if (cfg.System.Bitness?.Value is string)
        {
            // new schema
        }
        else if (cfg.System.Bitness?.Value == null && cfg.System.Bitness?.Mode == null)
        {
            cfg.System.Bitness = new TypedConfig<string> { Mode = "real" };
        }
        else if (cfg.System.Bitness == null)
        {
            cfg.System.Bitness = new TypedConfig<string> { Mode = "real" };
        }

        // Screen Mode migration
        if (string.IsNullOrWhiteSpace(cfg.System.Screen.Mode))
            cfg.System.Screen.Mode = "real";

        // ── Fingerprint TypedConfig migration
        // StorageQuota: new schema has Value property
        if (cfg.Fingerprint.StorageQuota?.Value is long)
        {
            // new schema
        }
        else if (cfg.Fingerprint.StorageQuota?.Mode == null)
        {
            cfg.Fingerprint.StorageQuota = new TypedConfig<long?> { Mode = "real", Value = null };
        }

        // TLSOSMatch
        if (cfg.Fingerprint.TLSOSMatch?.Value is string)
        {
            // new schema
        }
        else if (cfg.Fingerprint.TLSOSMatch?.Mode == null)
        {
            cfg.Fingerprint.TLSOSMatch = new TypedConfig<string> { Mode = "real" };
        }

        // DoNotTrack: new schema has Mode/Value properties
        if (cfg.Fingerprint.DoNotTrack?.Mode != null)
        {
            // new schema (DoNotTrackConfig has Mode property)
        }
        else if (cfg.Fingerprint.DoNotTrack == null)
        {
            cfg.Fingerprint.DoNotTrack = new DoNotTrackConfig { Mode = "real", Value = null };
        }

        // Plugins: new schema has Mode property
        if (cfg.Fingerprint.Plugins?.Mode != null)
        {
            // new schema (PluginsConfig has Mode property)
        }
        else if (cfg.Fingerprint.Plugins == null)
        {
            cfg.Fingerprint.Plugins = new PluginsConfig { Mode = "default", PluginList = new List<PluginInfo>() };
        }

        // Fonts: new schema has Mode property
        if (cfg.Fingerprint.Fonts?.Mode != null)
        {
            // new schema (FontsConfig has Mode property)
        }
        else if (cfg.Fingerprint.Fonts == null)
        {
            cfg.Fingerprint.Fonts = new FontsConfig { Mode = "real", FontList = new List<string>() };
        }

        // ── Fingerprint group Mode migration: null → "real"
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.WebGL?.Mode)) cfg.Fingerprint.WebGL!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.Canvas?.Mode)) cfg.Fingerprint.Canvas!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.Audio?.Mode)) cfg.Fingerprint.Audio!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.FontMetrics?.Mode)) cfg.Fingerprint.FontMetrics!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.ClientRects?.Mode)) cfg.Fingerprint.ClientRects!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.MediaDevices?.Mode)) cfg.Fingerprint.MediaDevices!.Mode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.SslMode)) cfg.Fingerprint.SslMode = "real";
        if (string.IsNullOrWhiteSpace(cfg.Fingerprint.SpeechVoicesMode)) cfg.Fingerprint.SpeechVoicesMode = "real";

        // ImageSpoofing Mode migration
        if (cfg.Fingerprint.WebGL?.ImageSpoofing != null &&
            string.IsNullOrWhiteSpace(cfg.Fingerprint.WebGL.ImageSpoofing.Mode))
            cfg.Fingerprint.WebGL.ImageSpoofing.Mode = "noise";

        // Connection Mode migration
        if (cfg.Fingerprint.Connection != null && string.IsNullOrWhiteSpace(cfg.Fingerprint.Connection.Mode))
            cfg.Fingerprint.Connection.Mode = "default";
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

    /// <summary>
    /// Migration: Copy BrowserVersion from Profile entity to SystemConfig.BrowserVersion
    /// in the ProfileData JSON if SystemConfig doesn't already have a BrowserVersion.
    /// </summary>
    private static string MigrateBrowserVersion(string profileData, string browserVersion)
    {
        try
        {
            var cfg = JsonSerializer.Deserialize<ProfileDataConfig>(profileData, NoScientificNotationOptions);
            if (cfg == null) return profileData;

            cfg.System ??= SystemConfig.Default;
            
            // Only migrate if SystemConfig.BrowserVersion is empty/null
            if (string.IsNullOrWhiteSpace(cfg.System.BrowserVersion))
            {
                cfg.System.BrowserVersion = browserVersion;
                return SerializeProfileData(cfg);
            }
        }
        catch
        {
            // If parsing fails, return original profileData unchanged
        }
        return profileData;
    }

    private class DoubleNoScientificNotationConverter : JsonConverter<double>
    {
        public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => reader.GetDouble();

        public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
        {
            if (double.IsNaN(value) || double.IsInfinity(value) || value == 0)
            {
                writer.WriteNumberValue(0);
                return;
            }
            // JsonSerializer already uses invariant culture for numbers by default
            writer.WriteNumberValue(value);
        }
    }

    public static string SerializeProfileData(object obj)
    {
        var json = JsonSerializer.Serialize(obj, NoScientificNotationOptions);
        // Replace scientific notation with decimal format using invariant culture
        var result = System.Text.RegularExpressions.Regex.Replace(json,
            @"-?\d+\.?\d*E-?\d+",
            m => {
                if (double.TryParse(m.Value, System.Globalization.CultureInfo.InvariantCulture, out double val))
                    return val.ToString("G17", System.Globalization.CultureInfo.InvariantCulture);
                return m.Value;
            });
        // #region agent log
        // #endregion
        return result;
    }

    public class RegenerateFingerprintResult
    {
        public int ProfileId { get; set; }
        public string CanvasSeed { get; set; } = "";
        public double? CanvasNoiseLevel { get; set; }
        public string AudioSeed { get; set; } = "";
        public double? AudioNoiseLevel { get; set; }
        public string FontSeed { get; set; } = "";
        public double? FontNoiseLevel { get; set; }
        public string RectsSeed { get; set; } = "";
        public double? RectsNoiseLevel { get; set; }
        public string WebGLSeed { get; set; } = "";
        public double? WebGLNoiseLevel { get; set; }
        public string ImageSeed { get; set; } = "";
    }

    public async Task<RegenerateFingerprintResult> RegenerateFingerprintAsync(int profileId)
    {
        var profile = await _profileRepo.GetByIdAsync(profileId);
        if (profile == null) throw new InvalidOperationException($"Profile {profileId} not found");

        var cfg = TryDeserialize(profile.ProfileData,
            () => JsonSerializer.Deserialize<ProfileDataConfig>(profile.ProfileData))
            ?? ProfileDataConfig.Default;

        cfg.Fingerprint ??= FingerprintConfig.Default;

        var newFp = await _fingerprintSvc.GenerateAsync(
            platform: null,
            browserType: profile.BrowserType,
            osModelName: null,
            screenWidth: null,
            screenHeight: null,
            pixelRatio: null,
            timezone: null,
            languages: null,
            webglVendor: null,
            webglRenderer: null
        );

        // Only regenerate seeds if the component is NOT in Real mode (null means Real)
        // Real mode should preserve null seeds so browser uses real fingerprint
        if (cfg.Fingerprint.Canvas.Mode != null)
        {
            cfg.Fingerprint.Canvas.NoiseSeed = newFp.Fingerprint.Canvas.NoiseSeed;
            cfg.Fingerprint.Canvas.NoiseLevel = newFp.Fingerprint.Canvas.NoiseLevel;
        }
        if (cfg.Fingerprint.Audio.Mode != null)
        {
            cfg.Fingerprint.Audio.NoiseSeed = newFp.Fingerprint.Audio.NoiseSeed;
            cfg.Fingerprint.Audio.NoiseLevel = newFp.Fingerprint.Audio.NoiseLevel;
        }
        if (cfg.Fingerprint.FontMetrics.Mode != null)
        {
            cfg.Fingerprint.FontMetrics.NoiseSeed = newFp.Fingerprint.FontMetrics.NoiseSeed;
            cfg.Fingerprint.FontMetrics.NoiseLevel = newFp.Fingerprint.FontMetrics.NoiseLevel;
        }
        if (cfg.Fingerprint.ClientRects.Mode != null)
        {
            cfg.Fingerprint.ClientRects.NoiseSeed = newFp.Fingerprint.ClientRects.NoiseSeed;
            cfg.Fingerprint.ClientRects.NoiseLevel = newFp.Fingerprint.ClientRects.NoiseLevel;
        }
        if (cfg.Fingerprint.WebGL.Mode != null)
        {
            cfg.Fingerprint.WebGL.NoiseSeed = newFp.Fingerprint.WebGL.NoiseSeed;
            cfg.Fingerprint.WebGL.NoiseLevel = newFp.Fingerprint.WebGL.NoiseLevel;
        }

        if (cfg.Fingerprint.WebGL.ImageSpoofing != null && newFp.Fingerprint.WebGL.ImageSpoofing != null)
        {
            cfg.Fingerprint.WebGL.ImageSpoofing.TextureSeed = newFp.Fingerprint.WebGL.ImageSpoofing.TextureSeed;
        }

        profile.ProfileData = SerializeProfileData(cfg);
        await _profileRepo.UpdateAsync(profile);

        return new RegenerateFingerprintResult
        {
            ProfileId = profileId,
            CanvasSeed = cfg.Fingerprint.Canvas.NoiseSeed ?? "",
            CanvasNoiseLevel = cfg.Fingerprint.Canvas.NoiseLevel,
            AudioSeed = cfg.Fingerprint.Audio.NoiseSeed ?? "",
            AudioNoiseLevel = cfg.Fingerprint.Audio.NoiseLevel,
            FontSeed = cfg.Fingerprint.FontMetrics.NoiseSeed ?? "",
            FontNoiseLevel = cfg.Fingerprint.FontMetrics.NoiseLevel,
            RectsSeed = cfg.Fingerprint.ClientRects.NoiseSeed ?? "",
            RectsNoiseLevel = cfg.Fingerprint.ClientRects.NoiseLevel,
            WebGLSeed = cfg.Fingerprint.WebGL.NoiseSeed ?? "",
            WebGLNoiseLevel = cfg.Fingerprint.WebGL.NoiseLevel,
            ImageSeed = cfg.Fingerprint.WebGL.ImageSpoofing?.TextureSeed ?? ""
        };
    }

    /// <summary>
    /// Helper to set TypedConfig&lt;T&gt;.Value = null without C# nullable type errors.
    /// For value types T (int, long), the backing field is Nullable<T> internally;
    /// we use reflection to set it to null.
    /// </summary>
    private static void SetTypedConfigValueNull<T>(TypedConfig<T> cfg) where T : struct
    {
        typeof(TypedConfig<T>).GetProperty("Value")!.SetValue(cfg, null);
    }
}
