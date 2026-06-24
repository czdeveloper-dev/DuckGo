using System.IO;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

/// <summary>
/// Builds DuckBrowser config from Profile entity and ProfileData JSON.
/// Maps ProfileDataConfig -> DuckBrowserConfig per duckbrowser_project_plan.md PHẦN 3.
/// Populates ALL fields including Navigator, TLS, WebGL2, WebRtc, Speech, UI, Security sub-configs.
/// </summary>
public class DuckBrowserConfigBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly FingerprintTemplate? _template;

    public DuckBrowserConfigBuilder() { }

    public DuckBrowserConfigBuilder(FingerprintTemplate template)
    {
        _template = template;
    }

    public DuckBrowserConfig BuildFromProfile(Profile profile)
    {
        var profileData = ParseProfileData(profile.ProfileData);
        return BuildFromProfileData(profile, profileData);
    }

    public DuckBrowserConfig BuildFromProfileData(Profile profile, ProfileDataConfig profileData)
    {
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
            UI = BuildUiConfig(profileData),
            Security = BuildSecurityConfig(profileData),
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
            return ProfileDataConfig.Default;
        }

        try
        {
            return JsonSerializer.Deserialize<ProfileDataConfig>(json, JsonOptions) ?? ProfileDataConfig.Default;
        }
        catch
        {
            return ProfileDataConfig.Default;
        }
    }

    private DuckSystemConfig BuildSystemConfig(ProfileDataConfig data)
    {
        var sys = data.System ?? new SystemConfig();

        var uaMode = sys.UserAgent?.Mode ?? "real";
        string userAgent;
        if (uaMode == "noise" && !string.IsNullOrWhiteSpace(sys.UserAgent?.Value))
        {
            userAgent = sys.UserAgent.Value;
        }
        else if (uaMode == "noise" && !string.IsNullOrWhiteSpace(sys.UserAgent?.Value) &&
                 sys.UserAgent.Value.Contains("{VERSION}"))
        {
            var version = sys.BrowserVersion ?? "138";
            userAgent = sys.UserAgent.Value.Replace("{VERSION}", version);
        }
        else if (uaMode == "random" || (uaMode == "noise" && string.IsNullOrWhiteSpace(sys.UserAgent?.Value)))
        {
            userAgent = GenerateUserAgentFromTemplate(sys);
        }
        else
        {
            userAgent = GenerateUserAgentFromTemplate(sys);
        }

        var hwMode = sys.HardwareConcurrency?.Mode ?? "real";
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
            hwConcurrency = sys.HardwareConcurrency?.Value ?? Environment.ProcessorCount;
            deviceMemory = sys.DeviceMemory?.Value ?? GetEstimatedDeviceMemory();
        }

        var langs = sys.Languages?.Count > 0 ? sys.Languages : new List<string> { sys.Language?.Value ?? "en-US" };
        var primaryLang = langs.FirstOrDefault() ?? "en-US";

        var screenMode = sys.Screen.Mode ?? "real";
        var screen = sys.Screen;

        return new DuckSystemConfig
        {
            BrowserVersion = sys.BrowserVersion ?? "138",
            Platform = sys.Platform?.Value ?? "Win32",
            Language = primaryLang,
            Languages = langs,
            UserAgent = userAgent,
            AcceptLanguage = sys.AcceptLanguage?.Value ?? string.Join(",", langs),
            Timezone = sys.Timezone?.Value ?? "UTC",
            TimezoneOffset = sys.TimezoneOffset ?? GetTimezoneOffsetMinutes(sys.Timezone?.Value ?? "UTC"),
            HardwareConcurrency = hwConcurrency,
            DeviceMemory = deviceMemory,
            Architecture = sys.Architecture?.Value ?? "x86",
            Bitness = sys.Bitness?.Value ?? "64",
            CpuBrand = sys.CpuBrand?.Value ?? GetCpuBrand(sys.Architecture?.Value ?? "x86"),
            Touch = new DuckTouchConfig
            {
                MaxTouchPoints = sys.Touch?.MaxTouchPoints ?? 0,
                TouchSupport = sys.Touch?.TouchSupport ?? false
            },
            Screen = new DuckScreenConfig
            {
                Width = screenMode == "noise" ? (screen.Width ?? 1920) : 1920,
                Height = screenMode == "noise" ? (screen.Height ?? 1080) : 1080,
                ColorDepth = screenMode == "noise" ? (screen.ColorDepth ?? 24) : 24,
                PixelRatio = screenMode == "noise" ? (screen.PixelRatio ?? 1.0) : 1.0,
                AvailWidth = screenMode == "noise" ? (screen.AvailWidth ?? screen.Width ?? 1920) : 1920,
                AvailHeight = screenMode == "noise" ? (screen.AvailHeight ?? (screen.Height ?? 1080) - 40) : 1040,
                AvailLeft = screenMode == "noise" ? (screen.AvailLeft ?? 0) : 0,
                AvailTop = screenMode == "noise" ? (screen.AvailTop ?? 0) : 0,
                OuterWidth = screenMode == "noise" ? (screen.Width ?? 1920) + 16 : 1936,
                OuterHeight = screenMode == "noise" ? (screen.Height ?? 1080) + 56 : 1136
            }
        };
    }

    private string GenerateUserAgentFromTemplate(SystemConfig sys)
    {
        var version = sys.BrowserVersion ?? "138";

        if (_template != null && !string.IsNullOrWhiteSpace(sys.Platform?.Value))
        {
            var osKey = sys.Platform.Value switch
            {
                var p when p.Contains("Win") => "Windows",
                var p when p.Contains("Mac") => "macOS",
                var p when p.Contains("Linux") && !p.Contains("Android") => "Linux",
                var p when p.Contains("Android") => "Android",
                var p when p.Contains("iPhone") || p.Contains("iPad") || p.Contains("iOS") => "iOS",
                _ => "Windows"
            };

            if (_template.OS.TryGetValue(osKey, out var osTmpl) && osTmpl.Models?.Count > 0)
            {
                var model = osTmpl.Models[Random.Shared.Next(osTmpl.Models.Count)];
                var ua = model.UserAgentTemplate.Replace("{VERSION}", version);
                return ua;
            }
        }

        var platform = sys.Platform?.Value ?? "Win32";
        return platform switch
        {
            var p when p.Contains("Mac") || p.Contains("iPhone") || p.Contains("iPad") =>
                $"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36",
            var p when p.Contains("Linux") && !p.Contains("Android") =>
                $"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36",
            var p when p.Contains("Android") =>
                $"Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Mobile Safari/537.36",
            var p when p.Contains("iPhone") || p.Contains("iPad") =>
                $"Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{version}/Mobile Safari/604.1",
            _ =>
                $"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36"
        };
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
        var ui = data.UI ?? new UIConfig();

        return new DuckFingerprintConfig
        {
            WebGL = new DuckWebGLConfig
            {
                Mode = NormalizeMode(webgl.Mode, "noise", preserveNullAsNull: true),
                Vendor = webgl.Vendor,
                Renderer = webgl.Renderer,
                NoiseSeed = webgl.Mode == "real" ? null : (webgl.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = webgl.NoiseLevel ?? 0.0001,
                Extensions = webgl.Extensions?.Count > 0 ? webgl.Extensions : null,
                MaxTextureSize = webgl.MaxTextureSize,
                ImageSpoofing = new DuckWebGLImageSpoofing
                {
                    Mode = NormalizeMode(webgl.ImageSpoofing?.Mode, "noise", preserveNullAsNull: true),
                    TextureSeed = webgl.ImageSpoofing?.Mode == "real"
                        ? null
                        : (webgl.ImageSpoofing?.Pattern == "default"
                            ? null
                            : (webgl.ImageSpoofing?.TextureSeed ?? GenerateSeed())),
                    Pattern = webgl.ImageSpoofing?.Pattern ?? "default"
                }
            },
            WebGL2 = new DuckWebGL2Config
            {
                Alpha = true,
                Depth = true,
                Stencil = false,
                Antialias = true,
                PremultipliedAlpha = true,
                PreserveDrawingBuffer = false,
                FailIfMajorPerformanceCaveat = false,
                XRCompatible = false,
                PowerPreference = "default",
                ShaderSource = new DuckShaderSourceConfig
                {
                    StripDebugMarkers = true,
                    DebugMarkers = new List<string> { "//SWIFTSHADER-DEBUG:", "//MESA-DBG:", "//HEADLESS-MARKER:" }
                }
            },
            Canvas = new DuckCanvasConfig
            {
                Mode = NormalizeMode(canvas.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = canvas.Mode == "real" ? null : (canvas.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = canvas.NoiseLevel ?? 0.00008
            },
            Audio = new DuckAudioConfig
            {
                Mode = NormalizeMode(audio.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = audio.Mode == "real" ? null : (audio.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = audio.NoiseLevel ?? 0.000001,
                SampleRate = audio.SampleRate ?? 48000
            },
            FontMetrics = new DuckFontMetricsConfig
            {
                Mode = NormalizeMode(fontMetrics.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = fontMetrics.Mode == "real" ? null : (fontMetrics.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = fontMetrics.NoiseLevel ?? 0.0001
            },
            ClientRects = new DuckClientRectsConfig
            {
                Mode = NormalizeMode(clientRects.Mode, "noise", preserveNullAsNull: true),
                NoiseSeed = clientRects.Mode == "real" ? null : (clientRects.NoiseSeed ?? GenerateSeed()),
                NoiseLevel = clientRects.NoiseLevel ?? 0.000025
            },
            Fonts = new DuckFontsConfig
            {
                Family = fonts.FontList?.Count > 0 ? fonts.FontList : null,
                Emoji = null
            },
            Navigator = new DuckNavigatorConfig
            {
                HardwareConcurrency = data.System?.HardwareConcurrency?.Value,
                DeviceMemory = data.System?.DeviceMemory?.Value,
                Platform = data.System?.Platform?.Value,
                Language = data.System?.Language?.Value?.Split(',').FirstOrDefault()?.Trim(),
                Languages = data.System?.Languages?.Count > 0 ? data.System.Languages : null,
                Vendor = "Google Inc.",
                AppCodeName = "Mozilla",
                AppName = "Netscape",
                Product = "Gecko",
                ProductSub = "20030107",
                DoNotTrack = fp.DoNotTrack?.Value,
                CookieEnabled = true,
                TLSOSMatch = fp.TLSOSMatch?.Value,
                VisualViewportScale = 1.0,
                VisualViewportOffsetLeft = 0.0,
                VisualViewportOffsetTop = 0.0,
                VisualViewportPageLeft = 0.0,
                VisualViewportPageTop = 0.0
            },
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
            TLS = new DuckTlsConfig
            {
                Os = fp.TLSOSMatch?.Value,
                CipherList = GetTlsCipherList(fp.TLSOSMatch?.Value ?? "Windows"),
                CurvesList = new List<string> { "X25519", "P-256", "P-384" }
            },
            Speech = new DuckSpeechConfig
            {
                Seed = Random.Shared.Next(1, 999999),
                Voices = null
            },
            WebRtc = new DuckWebRtcConfig
            {
                Policy = fp.WebRTcMode?.ToLowerInvariant() switch
                {
                    "disable" or "block" => "block_public_interface",
                    "proxy" => "proxy_only",
                    "real" => "default",
                    _ => "block_public_interface"
                },
                BlockNonProxiedUdp = true
            },
            Dns = new DuckDnsConfig
            {
                Policy = "real"
            },
            StorageQuota = fp.StorageQuota?.Value,
            Storage = new DuckStorageConfig
            {
                Persisted = true
            },
            TLSOSMatch = fp.TLSOSMatch?.Value,
            DoNotTrack = fp.DoNotTrack?.Value,
            Security = new DuckFingerprintSecurityConfig
            {
                PortBlockMode = data.Security?.PortBlockMode ?? "block_default",
                PortBlockList = data.Security?.PortBlockList ?? new List<string>(),
                Process = new DuckSecurityProcessConfig { Type = "renderer" },
                Window = new DuckSecurityWindowConfig { ChromeOffsetPx = 0 },
                DevTools = new DuckSecurityDevToolsConfig { HideApi = false, InjectProxy = false },
                Console = new DuckSecurityConsoleConfig { HardenProto = false },
                NodeGlobals = new DuckSecurityNodeGlobalsConfig { Mode = "keep" },
                ProtoGuard = new DuckSecurityProtoGuardConfig { ChainToObject = new List<string>(), RestoreFunctions = new List<string>() },
                CssAnimation = new DuckSecurityCssAnimationConfig
                {
                    AnimationPrefixes = new List<string>(),
                    KeyframesPrefixes = new List<string>(),
                    TransitionPrefixes = new List<string>(),
                    KeyframeNames = new List<string>()
                },
                ChromeInternal = new DuckSecurityChromeInternalConfig
                {
                    FakeCsiData = true,
                    FakeLoadTimes = true,
                    EmptyCommands = true,
                    ExtraLeakNames = new List<string>()
                },
                FeatureDetection = new DuckSecurityFeatureDetectionConfig
                {
                    IntersectionObserver = true,
                    HeadlessCssQueries = new List<string>(),
                    CssSupports = new DuckSecurityCssSupportsConfig { Mode = null, Entries = new List<string>() }
                },
                Script = new DuckSecurityScriptConfig
                {
                    FunctionToString = null,
                    ProtectedNativeFunctionNames = new List<string>(),
                    StackScrubMode = "rewrite",
                    FrameworkPathMarkers = new List<string>(),
                    EvalInvariants = new DuckSecurityEvalInvariantsConfig { Names = new List<string>() },
                    CssSupports = new DuckSecurityCssSupportsConfig { Mode = null, Entries = new List<string>() },
                    WasmTimingJitterMs = 1.0
                },
                Device = new DuckSecurityDeviceConfig
                {
                    MockFullscreenAPI = true,
                    MockCredentialManagement = true,
                    MockScreenOrientation = true,
                    MockPictureInPicture = true,
                    MockPointerLock = true,
                    MockWakeLock = true,
                    HideDeviceAPIs = true
                },
                Notification = new DuckSecurityNotificationConfig { PermissionPolicy = "granted" },
                BlobUrl = new DuckSecurityBlobUrlConfig { Format = $"blob:{{profile}}/{{uuid}}" }
            }
        };
    }

    private List<string> GetTlsCipherList(string osMatch)
    {
        return osMatch?.ToLowerInvariant() switch
        {
            "windows" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-RSA-AES128-GCM-SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
                "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-RSA-AES128-SHA", "ECDHE-RSA-AES256-SHA",
                "AES128-GCM-SHA256", "AES256-GCM-SHA384"
            },
            "macos" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384",
                "ECDHE-ECDSA-CHACHA20-POLY1305", "ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-RSA-AES128-GCM-SHA256",
                "AES256-GCM-SHA384", "AES128-GCM-SHA256"
            },
            "linux" => new List<string>
            {
                "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256", "TLS_AES_128_GCM_SHA256",
                "ECDHE-RSA-AES256-GCM-SHA384", "ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-RSA-AES128-GCM-SHA256", "AES256-GCM-SHA384", "AES128-GCM-SHA256"
            },
            "android" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES128-GCM-SHA256", "ECDHE-RSA-AES128-GCM-SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384", "ECDHE-RSA-AES256-GCM-SHA384"
            },
            "ios" => new List<string>
            {
                "TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256", "TLS_AES_128_GCM_SHA256",
                "ECDHE-256-AES256-GCM-SHA384", "ECDHE-256-AES128-GCM-SHA256",
                "AES256-GCM-SHA384", "AES128-GCM-SHA256"
            },
            _ => new List<string>
            {
                "TLS_AES_128_GCM_SHA256", "TLS_AES_256_GCM_SHA384",
                "ECDHE-RSA-AES128-GCM-SHA256", "ECDHE-RSA-AES256-GCM-SHA384",
                "AES128-GCM-SHA256", "AES256-GCM-SHA384"
            }
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

    private DuckUiConfig BuildUiConfig(ProfileDataConfig data)
    {
        var ui = data.UI ?? new UIConfig();
        var screen = data.System?.Screen;
        var screenW = screen?.Width ?? 1920;
        var screenH = screen?.Height ?? 1080;
        return new DuckUiConfig
        {
            Mode = ui.Mode ?? "GUI",
            Headless = new DuckHeadlessConfig
            {
                TimingJitterMs = 0.5,
                ChromeOffsetExtraPx = 16,
                PermissionPolicy = "prompt"
            },
            WindowSize = new DuckWindowSizeConfig
            {
                Width = ui.WindowSize?.Width ?? screenW,
                Height = ui.WindowSize?.Height ?? screenH
            }
        };
    }

    private DuckSecurityConfig BuildSecurityConfig(ProfileDataConfig data)
    {
        var sec = data.Security ?? new SecurityConfig();
        return new DuckSecurityConfig
        {
            PortBlockMode = sec.PortBlockMode ?? "block_default",
            PortBlockList = sec.PortBlockList ?? new List<string>()
        };
    }

    private static int GetEstimatedDeviceMemory()
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

    private static int GetTimezoneOffsetMinutes(string timezone)
    {
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(timezone);
            return (int)tz.BaseUtcOffset.TotalMinutes;
        }
        catch
        {
            return 0;
        }
    }

    private static string GetCpuBrand(string architecture)
    {
        return architecture?.ToLowerInvariant() switch
        {
            "arm" => "Apple Silicon",
            _ => "Intel Core i7-9700K"
        };
    }

    private static string? NormalizeMode(string? value, string fallback, bool preserveNullAsNull = false)
    {
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
}
