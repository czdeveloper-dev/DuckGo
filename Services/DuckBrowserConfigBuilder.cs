using System.IO;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

/// <summary>
/// Builds DuckBrowser config from Profile entity and ProfileData JSON
/// </summary>
public class DuckBrowserConfigBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public DuckBrowserConfig BuildFromProfile(Profile profile)
    {
        var profileData = ParseProfileData(profile.ProfileData);

        return new DuckBrowserConfig
        {
            Type = "CONFIG",
            Profile = new DuckProfileConfig
            {
                ProfileID = profile.Id.ToString(),
                ProfileName = profile.Name,
                StartURL = profileData.Profile?.StartURL
            },
            System = BuildSystemConfig(profileData),
            Fingerprint = BuildFingerprintConfig(profileData),
            Network = BuildNetworkConfig(profileData),
            Location = BuildLocationConfig(profileData),
            Security = new DuckSecurityConfig
            {
                PortBlockMode = profileData.Security?.PortBlockMode ?? "block_default",
                PortBlockList = profileData.Security?.PortBlockList ?? new List<string>()
            },
            FileSystem = new DuckFileSystemConfig
            {
                ProfilePath = Path.Combine(AppConfig.ProfilesDir, profile.Id.ToString()),
                DownloadLocation = Path.Combine(AppConfig.DownloadsDir, profile.Id.ToString())
            },
            ResourceLimits = new DuckResourceLimitsConfig
            {
                MaxMemoryMb = 512,
                TargetMemoryMb = 384,
                MaxCpuPercent = 50,
                ThreadLimit = 8,
                EnableMemoryOptimization = true,
                EnableCpuThrottling = true
            }
        };
    }

    private ProfileDataConfig ParseProfileData(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}")
        {
            return CreateEmptyProfileData();
        }

        try
        {
            return JsonSerializer.Deserialize<ProfileDataConfig>(json, JsonOptions) ?? CreateEmptyProfileData();
        }
        catch
        {
            return CreateEmptyProfileData();
        }
    }

    private DuckSystemConfig BuildSystemConfig(ProfileDataConfig data)
    {
        var sys = data.System ?? new SystemConfig();

        // Determine hardware values based on HardwareConcurrency.Mode
        var hwMode = sys.HardwareConcurrency?.Mode;
        int hwConcurrency;
        int deviceMemory;
        if (hwMode == "noise")
        {
            hwConcurrency = sys.HardwareConcurrency?.Value ?? 4;
            deviceMemory = sys.DeviceMemory?.Value ?? 4;
        }
        else if (hwMode == "default")
        {
            hwConcurrency = 4;
            deviceMemory = 4;
        }
        else
        {
            // real (or null): use real machine values
            hwConcurrency = sys.HardwareConcurrency?.Value ?? Environment.ProcessorCount;
            deviceMemory = sys.DeviceMemory?.Value ?? GetEstimatedDeviceMemory();
        }

        return new DuckSystemConfig
        {
            Platform = sys.Platform?.Value ?? "Win32",
            Language = sys.Language?.Value ?? "en-US",
            UserAgent = sys.UserAgent?.Mode == "noise"
                ? (sys.UserAgent?.Value ?? GetDefaultUserAgent())
                : GetDefaultUserAgent(),
            AcceptLanguage = sys.AcceptLanguage?.Value ?? "en-US,en;q=0.9",
            Timezone = sys.Timezone?.Value ?? "UTC",
            HardwareConcurrency = hwConcurrency,
            DeviceMemory = deviceMemory,
            Architecture = sys.Architecture?.Value ?? "x86",
            Bitness = sys.Bitness?.Value ?? "64",
            Screen = new DuckScreenConfig
            {
                Width = sys.Screen.Width ?? 1920,
                Height = sys.Screen.Height ?? 1080,
                ColorDepth = sys.Screen.ColorDepth ?? 24,
                PixelRatio = sys.Screen.PixelRatio ?? 1.0
            }
        };
    }

    private int GetEstimatedDeviceMemory()
    {
        try
        {
            var info = GC.GetGCMemoryInfo();
            var totalMB = info.TotalAvailableMemoryBytes / (1024 * 1024);
            return Math.Clamp((int)(totalMB / 1024), 2, 16);
        }
        catch
        {
            return 8;
        }
    }

        private DuckFingerprintConfig BuildFingerprintConfig(ProfileDataConfig data)
    {
        var fp = data.Fingerprint ?? new FingerprintConfig();
        var webgl = fp.WebGL ?? new WebGLConfig();
        var canvas = fp.Canvas ?? new CanvasConfig();
        var audio = fp.Audio ?? new AudioConfig();
        var fontMetrics = fp.FontMetrics ?? new FontMetricsConfig();
        var clientRects = fp.ClientRects ?? new ClientRectsConfig();
        var connection = fp.Connection ?? new ConnectionConfig();
        var mediaDevices = fp.MediaDevices ?? new MediaDevicesConfig();
        var fonts = fp.Fonts ?? new FontsConfig();
        var plugins = fp.Plugins ?? new PluginsConfig();

        return new DuckFingerprintConfig
        {
            WebGL = new DuckWebGLConfig
            {
                Mode = NormalizeMode(webgl.Mode, "noise", preserveNullAsNull: true),
                Vendor = webgl.Vendor,
                Renderer = webgl.Renderer,
                // Only use seed if NOT real mode
                NoiseSeed = webgl.Mode == "real" ? null : (webgl.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = webgl.NoiseLevel,
                ImageSpoofing = new DuckWebGLImageSpoofing
                {
                    Mode = NormalizeMode(webgl.ImageSpoofing?.Mode, "noise", preserveNullAsNull: true),
                    TextureSeed = webgl.ImageSpoofing?.Mode == "real" ? null : (webgl.ImageSpoofing?.TextureSeed ?? GenerateSeed()),
                    Pattern = webgl.ImageSpoofing?.Pattern ?? "default"
                }
            },
            Canvas = new DuckCanvasConfig
            {
                Mode = NormalizeMode(canvas.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = canvas.Mode == "real" ? null : (canvas.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = canvas.NoiseLevel
            },
            Audio = new DuckAudioConfig
            {
                Mode = NormalizeMode(audio.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = audio.Mode == "real" ? null : (audio.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = audio.NoiseLevel
            },
            FontMetrics = new DuckFontMetricsConfig
            {
                Mode = NormalizeMode(fontMetrics.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = fontMetrics.Mode == "real" ? null : (fontMetrics.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = fontMetrics.NoiseLevel
            },
            ClientRects = new DuckClientRectsConfig
            {
                Mode = NormalizeMode(clientRects.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = clientRects.Mode == "real" ? null : (clientRects.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = clientRects.NoiseLevel
            },
            Fonts = fonts.FontList,
            Plugins = ConvertPlugins(plugins.PluginList),
            Connection = new DuckConnectionConfig
            {
                Mode = NormalizeMode(connection.Mode, "noise", preserveNullAsNull: true),
                EffectiveType = connection.EffectiveType ?? "4g",
                Downlink = connection.Downlink,
                Rtt = connection.Rtt,
                SaveData = connection.SaveData
            },
            MediaDevices = new DuckMediaDevicesConfig
            {
                Mode = NormalizeMode(mediaDevices.Mode, "noise", preserveNullAsNull: true),
                VideoInputs = mediaDevices.VideoInputs,
                AudioInputs = mediaDevices.AudioInputs,
                AudioOutputs = mediaDevices.AudioOutputs
            },
            StorageQuota = fp.StorageQuota?.Value,
            TLSOSMatch = fp.TLSOSMatch?.Value,
            DoNotTrack = fp.DoNotTrack?.Value
        };
    }

    private List<DuckPluginConfig> ConvertPlugins(List<PluginInfo>? plugins)
    {
        if (plugins == null || plugins.Count == 0)
        {
            return new List<DuckPluginConfig>
            {
                new() { Name = "Chrome PDF Viewer", Filename = "internal-pdf-viewer", Description = "" }
            };
        }
        return plugins.Select(p => new DuckPluginConfig
        {
            Name = p.Name,
            Filename = p.Filename,
            Description = p.Description
        }).ToList();
    }

    private DuckNetworkConfig BuildNetworkConfig(ProfileDataConfig data)
    {
        var network = data.Network ?? new NetworkConfig();
        return new DuckNetworkConfig
        {
            Proxy = network.Proxy != null ? new DuckProxyConfig
            {
                Type = network.Proxy.Type ?? "http",
                Host = network.Proxy.Host,
                Port = network.Proxy.Port,
                Username = network.Proxy.Username,
                Password = network.Proxy.Password
            } : null
        };
    }

    private DuckLocationConfig BuildLocationConfig(ProfileDataConfig data)
    {
        var loc = data.Location ?? new LocationConfig();
        return new DuckLocationConfig
        {
            Mode = NormalizeMode(loc.Mode, "noise", preserveNullAsNull: true),
            Latitude = loc.Latitude,
            Longitude = loc.Longitude,
            Accuracy = loc.Accuracy
        };
    }

    private static ProfileDataConfig CreateEmptyProfileData()
    {
        return new ProfileDataConfig
        {
            Profile = new ProfileMetadataConfig(),
            Network = new NetworkConfig(),
            Security = new SecurityConfig(),
            Location = new LocationConfig(),
            System = null,
            Fingerprint = null
        };
    }

    private static string? NormalizeMode(string? value, string fallback, bool preserveNullAsNull = false)
    {
        // "real" means Real mode → DuckBrowser gets null (use browser real value)
        if (string.IsNullOrWhiteSpace(value) || value.Trim().ToLowerInvariant() == "real")
        {
            return preserveNullAsNull ? null : fallback;
        }
        return value.Trim().ToLowerInvariant();
    }

    private static string GenerateSeed()
    {
        return Guid.NewGuid().ToString("N")[..12];
    }

    private static string GetDefaultUserAgent()
    {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    }
}
