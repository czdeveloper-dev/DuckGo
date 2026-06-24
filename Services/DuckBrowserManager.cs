using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

/// <summary>
/// Manages DuckBrowser instances with Named Pipe handshake and CDP automation
/// Following the DuckBrowser protocol from duckbrowser_project_plan.md
/// </summary>
public class DuckBrowserManager : IDisposable
{
    private const string PipeName = "DuckBrowser_Control";
    private const int HeartbeatIntervalMs = 300;
    private const int HeartbeatTimeoutMs = 5000;
    private const string HmacKeyEnvVar = "DUCK_HMAC_KEY";

    private readonly ConcurrentDictionary<int, BrowserInstance> _instances = new();
    private readonly FingerprintTemplate? _fpTemplate;

    public event Action<int, int>? BrowserExited;

    public DuckBrowserManager() : this(FingerprintService.GetCachedTemplateSync()) { }

    public DuckBrowserManager(FingerprintTemplate? fpTemplate)
    {
        _fpTemplate = fpTemplate;
    }

    public async Task<BrowserLaunchResult> LaunchAsync(Models.Entities.Profile profile, string executablePath)
    {
        var profileId = profile.Id;

        // Step 1: Check if browser executable exists
        if (!File.Exists(executablePath))
        {
            return new BrowserLaunchResult { Success = false, Error = $"Browser not found at {executablePath}" };
        }

        var cdpPort = AppConfig.StartPort + profileId;

        try
        {
            // Step 2: Create profile directory
            var profileDir = Path.Combine(AppConfig.ProfilesDir, profileId.ToString());
            try
            {
                Directory.CreateDirectory(profileDir);
            }
            catch (Exception ex)
            {
                return new BrowserLaunchResult { Success = false, Error = $"Profile directory error: {ex.Message}" };
            }

            // Step 3: Build DuckBrowser full config (all fields per duckbrowser_project_plan.md)

            // Step 4: Build command line args per duckbrowser_project_plan.md
            // chrome.exe --remote-debugging-port=0 --no-first-run --no-default-browser-check --disable-metrics --disable-breakpad
            var args = $"--remote-debugging-port=0 " +
                       $"--no-first-run " +
                       $"--no-default-browser-check " +
                       $"--disable-metrics " +
                       $"--disable-breakpad";

            // Step 5: Spawn chrome.exe (NO env var, NO special args)
            var psi = new ProcessStartInfo
            {
                FileName = executablePath,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(executablePath)
            };

            var process = Process.Start(psi);
            if (process == null)
            {
                return new BrowserLaunchResult { Success = false, Error = "Failed to start process" };
            }

            // Step 6: Connect to Named Pipe DuckBrowser_Control within timeout
            // DuckBrowser waits ~10s for backend connection
            DuckBrowserPipeConnection? pipeConnection = null;
            var pipeConnected = false;

            for (int i = 0; i < 90; i++)
            {
                try
                {
                    pipeConnection = new DuckBrowserPipeConnection(PipeName);
                    pipeConnected = await pipeConnection.ConnectAsync(200);
                    if (pipeConnected)
                        break;
                }
                catch { }

                await Task.Delay(100);
            }

            if (pipeConnected && pipeConnection != null)
            {
                // Step 7: Build full DuckBrowser config
                // Per duckbrowser_project_plan.md PHẦN 4: full config sent in CONNECT message
                var fullConfig = BuildFullBrowserConfig(profile, profileDir);
                string hmacKey = Environment.GetEnvironmentVariable(HmacKeyEnvVar)
                    ?? "duckbrowser_default_key_change_in_production";
                string hmacToken = GenerateHmacToken(hmacKey, profile.Id.ToString(), out string ts);

                // CONNECT message with full config nested (Format 2 per C++ duck_pipe_server.cc)
                var connectPayload = new
                {
                    profileId = profile.Id.ToString(),
                    profileName = profile.Name,
                    startUrl = fullConfig.Profile?.StartURL,
                    hmacToken = hmacToken,
                    timestamp = ts,
                    config = fullConfig
                };
                var connectJson = JsonSerializer.Serialize(connectPayload, DuckPipeMessageContext.Default.Options);
                await pipeConnection.SendFramedMessageAsync("CONNECT", profile.Id.ToString(), connectJson);

                // Step 8: Wait for CDP_READY response
                var response = await pipeConnection.ReceiveMessageAsync(3000);

                if (response?.Type == "CDP_READY" || response?.Type == "READY")
                {
                    // Extract CDP port from response if available
                    if (response.CdpPort.HasValue && response.CdpPort.Value > 0)
                        cdpPort = response.CdpPort.Value;

                    // Step 9: Send FS_CONFIG (file paths)
                    // CONFIG was already sent nested in CONNECT — no separate CONFIG message needed
                    var fsConfig = new
                    {
                        FileSystem = new
                        {
                            ProfilePath = profileDir,
                            DownloadLocation = Path.Combine(AppConfig.DownloadsDir, profileId.ToString())
                        }
                    };
                    var fsJson = JsonSerializer.Serialize(fsConfig, DuckPipeMessageContext.Default.Options);
                    await pipeConnection.SendFramedMessageAsync("FS_CONFIG", profile.Id.ToString(), fsJson);

                    // Step 10: Send RESOURCE_LIMITS
                    var resConfig = new
                    {
                        ResourceLimits = new
                        {
                            max_memory_mb = 512,
                            target_memory_mb = 384,
                            max_cpu_percent = 50,
                            thread_limit = 8,
                            enable_memory_optimization = true,
                            enable_cpu_throttling = true
                        }
                    };
                    var resJson = JsonSerializer.Serialize(resConfig, DuckPipeMessageContext.Default.Options);
                    await pipeConnection.SendFramedMessageAsync("RESOURCE_LIMITS", profile.Id.ToString(), resJson);

                    // Step 11: Start heartbeat monitor
                    _ = MonitorHeartbeatAsync(pipeConnection, profileId);
                }
                else
                {
                    // Pipe connected but no CDP_READY — proceed without pipe-based CDP port
                    pipeConnection?.Dispose();
                    pipeConnection = null;
                }
            }
            else
            {
                pipeConnection?.Dispose();
                pipeConnection = null;
            }

            // Step 13: Wait for browser to stabilize
            await Task.Delay(1000);

            if (process.HasExited)
            {
                pipeConnection?.Dispose();
                return new BrowserLaunchResult
                {
                    Success = false,
                    Error = $"Browser exited with code {process.ExitCode}"
                };
            }

            // Step 14: Store instance
            var instance = new BrowserInstance
            {
                ProfileId = profileId,
                Process = process,
                CdpPort = cdpPort,
                PipeConnection = pipeConnection
            };

            _instances[profileId] = instance;

            process.EnableRaisingEvents = true;
            process.Exited += (_, _) =>
            {
                _instances.TryRemove(profileId, out _);
                pipeConnection?.Dispose();
                BrowserExited?.Invoke(profileId, process.ExitCode);
            };

            return new BrowserLaunchResult
            {
                Success = true,
                ProfileId = profileId,
                CdpPort = cdpPort
            };
        }
        catch (Exception ex)
        {
            return new BrowserLaunchResult { Success = false, Error = ex.Message };
        }
    }

    private DuckBrowserConfig BuildFullBrowserConfig(Models.Entities.Profile profile, string profileDir)
    {
        var profileData = ParseProfileData(profile.ProfileData);
        var profileDataConfig = profileData ?? ProfileDataConfig.Default;

        // Derive OS template overrides from the fingerprint template based on platform
        OsTemplate? osTemplateOverride = null;
        if (_fpTemplate != null)
        {
            var platform = profileDataConfig.System?.Platform?.Value ?? "";
            var osKey = PlatformToOsKey(platform);
            _fpTemplate.OS.TryGetValue(osKey, out osTemplateOverride);
        }

        return new DuckBrowserConfig
        {
            Type = "CONFIG",
            Profile = new DuckProfileConfig
            {
                ProfileID = profile.Id.ToString(),
                ProfileName = profile.Name,
                StartURL = profileDataConfig.Profile?.StartURL
            },
            System = BuildSystemConfig(profileDataConfig, osTemplateOverride),
            Fingerprint = BuildFingerprintConfig(profileDataConfig, osTemplateOverride),
            Network = BuildNetworkConfig(profileDataConfig),
            Location = BuildLocationConfig(profileDataConfig),
            UI = BuildUiConfig(profileDataConfig),
            Security = BuildSecurityConfig(profileDataConfig),
            FileSystem = new DuckFileSystemConfig
            {
                ProfilePath = profileDir,
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

    private ProfileDataConfig? ParseProfileData(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}") return null;
        try { return JsonSerializer.Deserialize<ProfileDataConfig>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
        catch { return null; }
    }

    private DuckSystemConfig BuildSystemConfig(ProfileDataConfig? data, OsTemplate? osTemplateOverride)
    {
        var sys = data?.System;
        var hwMode = sys?.HardwareConcurrency?.Mode ?? "real";
        int hwConcurrency, deviceMemory;
        if (hwMode == "noise") { hwConcurrency = sys?.HardwareConcurrency?.Value ?? 4; deviceMemory = sys?.DeviceMemory?.Value ?? 4; }
        else if (hwMode == "default") { hwConcurrency = 4; deviceMemory = 4; }
        else { hwConcurrency = sys?.HardwareConcurrency?.Value ?? Environment.ProcessorCount; deviceMemory = sys?.DeviceMemory?.Value ?? GetEstimatedDeviceMemory(); }

        var langs = sys?.Languages?.Count > 0 ? sys.Languages : new List<string> { sys?.Language?.Value ?? "en-US" };
        var version = sys?.BrowserVersion ?? "138";
        string ua;
        var uaMode = sys?.UserAgent?.Mode ?? "real";

        // Prefer UserAgent from ProfileDataConfig, else derive from template
        if (uaMode == "noise" && !string.IsNullOrWhiteSpace(sys?.UserAgent?.Value))
        {
            ua = sys.UserAgent.Value.Contains("{VERSION}")
                ? sys.UserAgent.Value.Replace("{VERSION}", version)
                : sys.UserAgent.Value;
        }
        else
        {
            ua = GenerateUserAgentFromTemplate(osTemplateOverride, sys?.Platform?.Value ?? "Win32", version);
        }

        var screenMode = sys?.Screen?.Mode ?? "real";
        var scr = sys?.Screen;

        // Use template for hardware tier defaults when ProfileDataConfig has no explicit value
        var hwTier = osTemplateOverride?.HardwareTiers?.Count > 0
            ? osTemplateOverride.HardwareTiers[Random.Shared.Next(osTemplateOverride.HardwareTiers.Count)]
            : null;

        var arch = sys?.Architecture?.Value ?? osTemplateOverride?.Models?.FirstOrDefault()?.Architecture ?? "x86";
        var tlsOsMatch = sys?.Platform?.Value switch
        {
            var p when p != null && (p.Contains("Win")) => "windows",
            var p when p != null && (p.Contains("Mac") || p.Contains("iPhone") || p.Contains("iPad")) => "macos",
            var p when p != null && p.Contains("Linux") && !p.Contains("Android") => "linux",
            var p when p != null && p.Contains("Android") => "android",
            var p when p != null && p.Contains("iPhone") || p.Contains("iPad") => "ios",
            _ => "windows"
        };

        return new DuckSystemConfig
        {
            BrowserVersion = version,
            Platform = sys?.Platform?.Value ?? "Win32",
            Language = langs.FirstOrDefault() ?? "en-US",
            Languages = langs,
            UserAgent = ua,
            AcceptLanguage = sys?.AcceptLanguage?.Value ?? string.Join(",", langs),
            Timezone = sys?.Timezone?.Value ?? "UTC",
            TimezoneOffset = sys?.TimezoneOffset ?? GetTimezoneOffsetMinutes(sys?.Timezone?.Value ?? "UTC"),
            HardwareConcurrency = hwConcurrency,
            DeviceMemory = deviceMemory,
            Architecture = arch,
            Bitness = sys?.Bitness?.Value ?? osTemplateOverride?.Models?.FirstOrDefault()?.Bitness ?? "64",
            CpuBrand = sys?.CpuBrand?.Value ?? GetCpuBrandFromArchitecture(arch),
            Touch = new DuckTouchConfig { MaxTouchPoints = sys?.Touch?.MaxTouchPoints ?? 0, TouchSupport = sys?.Touch?.TouchSupport ?? false },
            Screen = new DuckScreenConfig
            {
                Width = screenMode == "noise" ? (scr?.Width ?? 1920) : 1920,
                Height = screenMode == "noise" ? (scr?.Height ?? 1080) : 1080,
                ColorDepth = screenMode == "noise" ? (scr?.ColorDepth ?? 24) : 24,
                PixelRatio = screenMode == "noise" ? (scr?.PixelRatio ?? 1.0) : 1.0,
                AvailWidth = screenMode == "noise" ? (scr?.AvailWidth ?? scr?.Width ?? 1920) : 1920,
                AvailHeight = screenMode == "noise" ? ((scr?.AvailHeight) ?? (scr?.Height ?? 1080) - 40) : 1040,
                AvailLeft = 0,
                AvailTop = 0,
                OuterWidth = (screenMode == "noise" ? (scr?.Width ?? 1920) : 1920) + 16,
                OuterHeight = (screenMode == "noise" ? (scr?.Height ?? 1080) : 1080) + 56
            }
        };
    }

    private string GenerateUserAgentFromTemplate(OsTemplate? osTemplate, string platform, string version)
    {
        if (osTemplate?.Models?.Count > 0)
        {
            var model = osTemplate.Models[Random.Shared.Next(osTemplate.Models.Count)];
            if (!string.IsNullOrWhiteSpace(model.UserAgentTemplate))
                return model.UserAgentTemplate.Replace("{VERSION}", version);
        }
        return GenerateDefaultUserAgent(platform, version);
    }

    private static string GetCpuBrandFromArchitecture(string architecture)
    {
        return architecture?.ToLowerInvariant() switch
        {
            "arm" => "Apple Silicon",
            _ => "Intel Core i7-9700K"
        };
    }

    private DuckFingerprintConfig BuildFingerprintConfig(ProfileDataConfig? data, OsTemplate? osTemplateOverride)
    {
        var fp = data?.Fingerprint ?? new FingerprintConfig();
        var webgl = fp.WebGL ?? new WebGLConfig();
        var canvas = fp.Canvas ?? new CanvasConfig();
        var audio = fp.Audio ?? new AudioConfig();
        var fontMetrics = fp.FontMetrics ?? new FontMetricsConfig();
        var clientRects = fp.ClientRects ?? new ClientRectsConfig();
        var connection = fp.Connection ?? new ConnectionConfig();
        var mediaDevices = fp.MediaDevices ?? new MediaDevicesConfig();
        var fonts = fp.Fonts ?? new FontsConfig();
        var plugins = fp.Plugins ?? new PluginsConfig();

        // Resolve TLS from template (TLSOSMatch key → TLS section in template)
        var tlsOsMatch = fp.TLSOSMatch?.Value ?? osTemplateOverride?.Models?.FirstOrDefault()?.TLSOSMatch ?? "windows";
        var tlsFromTemplate = GetTlsFromTemplate(tlsOsMatch);
        var tlsCiphers = tlsFromTemplate?.CipherList?.Count > 0 ? tlsFromTemplate.CipherList : GetDefaultTlsCipherList(tlsOsMatch);
        var tlsCurves = tlsFromTemplate?.CurvesList?.Count > 0 ? tlsFromTemplate.CurvesList : new List<string> { "X25519", "P-256", "P-384" };

        return new DuckFingerprintConfig
        {
            WebGL = new DuckWebGLConfig
            {
                Mode = fp.WebGL?.Mode ?? "noise",
                Vendor = webgl.Vendor,
                Renderer = webgl.Renderer,
                NoiseSeed = webgl.Mode == "real" ? null : (webgl.NoiseSeed ?? Guid.NewGuid().ToString("N")[..12]),
                NoiseLevel = webgl.NoiseLevel ?? 0.0001,
                Extensions = webgl.Extensions?.Count > 0 ? webgl.Extensions : osTemplateOverride?.WebGL?.Extensions,
                MaxTextureSize = webgl.MaxTextureSize ?? osTemplateOverride?.WebGL?.MaxTextureSize,
                ImageSpoofing = new DuckWebGLImageSpoofing
                {
                    Mode = webgl.ImageSpoofing?.Mode ?? "noise",
                    TextureSeed = webgl.Mode == "real" ? null : (webgl.ImageSpoofing?.Pattern == "default" ? null : (webgl.ImageSpoofing?.TextureSeed ?? Guid.NewGuid().ToString("N")[..12])),
                    Pattern = webgl.ImageSpoofing?.Pattern ?? "default"
                }
            },
            WebGL2 = new DuckWebGL2Config
            {
                Alpha = true, Depth = true, Stencil = false, Antialias = true,
                PremultipliedAlpha = true, PreserveDrawingBuffer = false,
                FailIfMajorPerformanceCaveat = false, XRCompatible = false,
                PowerPreference = "default",
                ShaderSource = new DuckShaderSourceConfig
                {
                    StripDebugMarkers = true,
                    DebugMarkers = new List<string> { "//SWIFTSHADER-DEBUG:", "//MESA-DBG:", "//HEADLESS-MARKER:" }
                }
            },
            Canvas = new DuckCanvasConfig
            {
                Mode = canvas.Mode ?? "noise",
                NoiseSeed = canvas.Mode == "real" ? null : (canvas.NoiseSeed ?? Guid.NewGuid().ToString("N")[..12]),
                NoiseLevel = canvas.NoiseLevel ?? 0.00008
            },
            Audio = new DuckAudioConfig
            {
                Mode = audio.Mode ?? "noise",
                NoiseSeed = audio.Mode == "real" ? null : (audio.NoiseSeed ?? Guid.NewGuid().ToString("N")[..12]),
                NoiseLevel = audio.NoiseLevel ?? 0.000001,
                SampleRate = audio.SampleRate ?? 48000
            },
            FontMetrics = new DuckFontMetricsConfig
            {
                Mode = fontMetrics.Mode ?? "noise",
                NoiseSeed = fontMetrics.Mode == "real" ? null : (fontMetrics.NoiseSeed ?? Guid.NewGuid().ToString("N")[..12]),
                NoiseLevel = fontMetrics.NoiseLevel ?? 0.0001
            },
            ClientRects = new DuckClientRectsConfig
            {
                Mode = clientRects.Mode ?? "noise",
                NoiseSeed = clientRects.Mode == "real" ? null : (clientRects.NoiseSeed ?? Guid.NewGuid().ToString("N")[..12]),
                NoiseLevel = clientRects.NoiseLevel ?? 0.000025
            },
            Fonts = new DuckFontsConfig { Family = fonts.FontList?.Count > 0 ? fonts.FontList : null, Emoji = null },
            Navigator = new DuckNavigatorConfig
            {
                HardwareConcurrency = data?.System?.HardwareConcurrency?.Value,
                DeviceMemory = data?.System?.DeviceMemory?.Value,
                Platform = data?.System?.Platform?.Value,
                Language = data?.System?.Language?.Value?.Split(',').FirstOrDefault()?.Trim(),
                Languages = data?.System?.Languages?.Count > 0 ? data.System.Languages : null,
                Vendor = "Google Inc.", AppCodeName = "Mozilla", AppName = "Netscape",
                Product = "Gecko", ProductSub = "20030107",
                DoNotTrack = fp.DoNotTrack?.Value,
                CookieEnabled = true,
                TLSOSMatch = fp.TLSOSMatch?.Value,
                VisualViewportScale = 1.0, VisualViewportOffsetLeft = 0.0,
                VisualViewportOffsetTop = 0.0, VisualViewportPageLeft = 0.0, VisualViewportPageTop = 0.0
            },
            Plugins = ConvertPlugins(plugins.PluginList),
            Connection = new DuckConnectionConfig
            {
                Mode = connection.Mode ?? "noise",
                EffectiveType = connection.EffectiveType ?? "4g",
                Downlink = connection.Downlink,
                Rtt = connection.Rtt,
                SaveData = connection.SaveData
            },
            MediaDevices = new DuckMediaDevicesConfig
            {
                Mode = mediaDevices.Mode ?? "noise",
                VideoInputs = mediaDevices.VideoInputs,
                AudioInputs = mediaDevices.AudioInputs,
                AudioOutputs = mediaDevices.AudioOutputs
            },
            TLS = new DuckTlsConfig
            {
                Os = tlsOsMatch,
                CipherList = tlsCiphers,
                CurvesList = tlsCurves
            },
            Speech = new DuckSpeechConfig { Seed = Random.Shared.Next(1, 999999), Voices = null },
            WebRtc = new DuckWebRtcConfig
            {
                Policy = fp.WebRTcMode?.ToLowerInvariant() switch { "disable" or "block" => "block_public_interface", "proxy" => "proxy_only", "real" => "default", _ => "block_public_interface" },
                BlockNonProxiedUdp = true
            },
            Dns = new DuckDnsConfig { Policy = "real" },
            StorageQuota = fp.StorageQuota?.Value,
            Storage = new DuckStorageConfig { Persisted = true },
            TLSOSMatch = fp.TLSOSMatch?.Value,
            DoNotTrack = fp.DoNotTrack?.Value,
            Security = new DuckFingerprintSecurityConfig
            {
                PortBlockMode = data?.Security?.PortBlockMode ?? "block_default",
                PortBlockList = data?.Security?.PortBlockList ?? new List<string>(),
                Process = new DuckSecurityProcessConfig { Type = "renderer" },
                Window = new DuckSecurityWindowConfig { ChromeOffsetPx = 0 },
                DevTools = new DuckSecurityDevToolsConfig { HideApi = false, InjectProxy = false },
                Console = new DuckSecurityConsoleConfig { HardenProto = false },
                NodeGlobals = new DuckSecurityNodeGlobalsConfig { Mode = "keep" },
                ProtoGuard = new DuckSecurityProtoGuardConfig { ChainToObject = new List<string>(), RestoreFunctions = new List<string>() },
                CssAnimation = new DuckSecurityCssAnimationConfig
                {
                    AnimationPrefixes = new List<string>(), KeyframesPrefixes = new List<string>(),
                    TransitionPrefixes = new List<string>(), KeyframeNames = new List<string>()
                },
                ChromeInternal = new DuckSecurityChromeInternalConfig
                {
                    FakeCsiData = true, FakeLoadTimes = true, EmptyCommands = true, ExtraLeakNames = new List<string>()
                },
                FeatureDetection = new DuckSecurityFeatureDetectionConfig
                {
                    IntersectionObserver = true, HeadlessCssQueries = new List<string>(),
                    CssSupports = new DuckSecurityCssSupportsConfig { Mode = null, Entries = new List<string>() }
                },
                Script = new DuckSecurityScriptConfig
                {
                    FunctionToString = null, ProtectedNativeFunctionNames = new List<string>(),
                    StackScrubMode = "rewrite", FrameworkPathMarkers = new List<string>(),
                    EvalInvariants = new DuckSecurityEvalInvariantsConfig { Names = new List<string>() },
                    CssSupports = new DuckSecurityCssSupportsConfig { Mode = null, Entries = new List<string>() },
                    WasmTimingJitterMs = 1.0
                },
                Device = new DuckSecurityDeviceConfig
                {
                    MockFullscreenAPI = true, MockCredentialManagement = true,
                    MockScreenOrientation = true, MockPictureInPicture = true,
                    MockPointerLock = true, MockWakeLock = true, HideDeviceAPIs = true
                },
                Notification = new DuckSecurityNotificationConfig { PermissionPolicy = "granted" },
                BlobUrl = new DuckSecurityBlobUrlConfig { Format = $"blob:{{profile}}/{{uuid}}" }
            }
        };
    }

    private List<DuckPluginConfig> ConvertPlugins(List<PluginInfo>? plugins)
    {
        if (plugins == null || plugins.Count == 0)
            return new List<DuckPluginConfig> { new() { Name = "Chrome PDF Viewer", Filename = "internal-pdf-viewer", Description = "" } };
        return plugins.Select(p => new DuckPluginConfig { Name = p.Name, Filename = p.Filename, Description = p.Description }).ToList();
    }

    private DuckNetworkConfig BuildNetworkConfig(ProfileDataConfig? data)
    {
        var proxy = data?.Network?.Proxy;
        return new DuckNetworkConfig
        {
            Proxy = proxy != null ? new DuckProxyConfig
            {
                Type = proxy.Type ?? "http",
                Host = proxy.Host,
                Port = proxy.Port,
                Username = proxy.Username,
                Password = proxy.Password
            } : null
        };
    }

    private DuckLocationConfig BuildLocationConfig(ProfileDataConfig? data)
    {
        var loc = data?.Location;
        return new DuckLocationConfig
        {
            Mode = loc?.Mode ?? "noise",
            Latitude = loc?.Latitude,
            Longitude = loc?.Longitude,
            Accuracy = loc?.Accuracy
        };
    }

    private DuckUiConfig BuildUiConfig(ProfileDataConfig? data)
    {
        var ui = data?.UI;
        var screen = data?.System?.Screen;
        return new DuckUiConfig
        {
            Mode = ui?.Mode ?? "GUI",
            Headless = new DuckHeadlessConfig { TimingJitterMs = 0.5, ChromeOffsetExtraPx = 16, PermissionPolicy = "prompt" },
            WindowSize = new DuckWindowSizeConfig
            {
                Width = ui?.WindowSize?.Width ?? screen?.Width ?? 1920,
                Height = ui?.WindowSize?.Height ?? screen?.Height ?? 1080
            }
        };
    }

    private DuckSecurityConfig BuildSecurityConfig(ProfileDataConfig? data)
    {
        var sec = data?.Security;
        return new DuckSecurityConfig
        {
            PortBlockMode = sec?.PortBlockMode ?? "block_default",
            PortBlockList = sec?.PortBlockList ?? new List<string>()
        };
    }

    private static int GetEstimatedDeviceMemory()
    {
        try { var info = GC.GetGCMemoryInfo(); return Math.Clamp((int)(info.TotalAvailableMemoryBytes / (1024 * 1024 * 1024)), 2, 16); }
        catch { return 8; }
    }

    private static int GetTimezoneOffsetMinutes(string? timezone)
    {
        try { return (int)TimeZoneInfo.FindSystemTimeZoneById(timezone ?? "UTC").BaseUtcOffset.TotalMinutes; }
        catch { return 0; }
    }

    private TlsFingerprintTemplate? GetTlsFromTemplate(string osKey)
    {
        if (_fpTemplate == null) return null;
        var osKeyNorm = osKey.ToLowerInvariant();
        foreach (var kvp in _fpTemplate.OS)
        {
            if (kvp.Value.TLS != null && kvp.Value.TLS.Os.ToLowerInvariant() == osKeyNorm)
                return kvp.Value.TLS;
        }
        return null;
    }

    private static string PlatformToOsKey(string platform)
    {
        var p = (platform ?? "").ToLowerInvariant();
        if (p.Contains("win")) return "Windows";
        if (p.Contains("mac") || p.Contains("iphone") || p.Contains("ipad")) return "macOS";
        if (p.Contains("linux") && !p.Contains("android")) return "Linux";
        if (p.Contains("android")) return "Android";
        if (p.Contains("iphone") || p.Contains("ipad") || p.Contains("ios")) return "iOS";
        return "Windows";
    }

    private static List<string> GetDefaultTlsCipherList(string os)
    {
        return os.ToLowerInvariant() switch
        {
            "windows" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256","TLS_AES_256_GCM_SHA384","TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES128-GCM-SHA256","ECDHE-RSA-AES128-GCM-SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384","ECDHE-RSA-AES256-GCM-SHA384",
                "ECDHE-ECDSA-CHACHA20-POLY1305","ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-RSA-AES128-SHA","ECDHE-RSA-AES256-SHA",
                "AES128-GCM-SHA256","AES256-GCM-SHA384"
            },
            "macos" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256","TLS_AES_256_GCM_SHA384","TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384","ECDHE-RSA-AES256-GCM-SHA384",
                "ECDHE-ECDSA-CHACHA20-POLY1305","ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-ECDSA-AES128-GCM-SHA256","ECDHE-RSA-AES128-GCM-SHA256",
                "AES256-GCM-SHA384","AES128-GCM-SHA256"
            },
            "linux" => new List<string>
            {
                "TLS_AES_256_GCM_SHA384","TLS_CHACHA20_POLY1305_SHA256","TLS_AES_128_GCM_SHA256",
                "ECDHE-RSA-AES256-GCM-SHA384","ECDHE-RSA-CHACHA20-POLY1305",
                "ECDHE-RSA-AES128-GCM-SHA256","AES256-GCM-SHA384","AES128-GCM-SHA256"
            },
            "android" => new List<string>
            {
                "TLS_AES_128_GCM_SHA256","TLS_AES_256_GCM_SHA384","TLS_CHACHA20_POLY1305_SHA256",
                "ECDHE-ECDSA-AES128-GCM-SHA256","ECDHE-RSA-AES128-GCM-SHA256",
                "ECDHE-ECDSA-AES256-GCM-SHA384","ECDHE-RSA-AES256-GCM-SHA384"
            },
            "ios" => new List<string>
            {
                "TLS_AES_256_GCM_SHA384","TLS_CHACHA20_POLY1305_SHA256","TLS_AES_128_GCM_SHA256",
                "ECDHE-256-AES256-GCM-SHA384","ECDHE-256-AES128-GCM-SHA256",
                "AES256-GCM-SHA384","AES128-GCM-SHA256"
            },
            _ => new List<string>
            {
                "TLS_AES_128_GCM_SHA256","TLS_AES_256_GCM_SHA384",
                "ECDHE-RSA-AES128-GCM-SHA256","ECDHE-RSA-AES256-GCM-SHA384",
                "AES128-GCM-SHA256","AES256-GCM-SHA384"
            }
        };
    }

    private static string GenerateDefaultUserAgent(string platform, string version)
    {
        return platform switch
        {
            var p when p.Contains("Mac") || p.Contains("iPhone") || p.Contains("iPad") =>
                $"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36",
            var p when p.Contains("Linux") && !p.Contains("Android") =>
                $"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36",
            var p when p.Contains("Android") =>
                $"Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Mobile Safari/537.36",
            _ => $"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version}.0.0.0 Safari/537.36"
        };
    }

    private async Task MonitorHeartbeatAsync(DuckBrowserPipeConnection? connection, int profileId)
    {
        if (connection == null) return;

        try
        {
            while (_instances.ContainsKey(profileId))
            {
                await Task.Delay(HeartbeatIntervalMs);

                try
                {
                    await connection.SendFramedMessageAsync("PING", profileId.ToString(), "{\"ping\":true}");
                    var response = await connection.ReceiveMessageAsync(1000);
                    if (response?.Type != "PONG")
                        break;
                }
                catch
                {
                    break;
                }
            }
        }
        catch { }
    }

    public async Task<bool> StopAsync(int profileId)
    {
        if (!_instances.TryGetValue(profileId, out var instance))
            return true;

        try
        {
            if (instance.PipeConnection?.IsConnected == true)
            {
                try
                {
                    await instance.PipeConnection.SendFramedMessageAsync("STOP", profileId.ToString(), "{}");
                }
                catch { }
            }

            if (!instance.Process.HasExited)
            {
                instance.Process.Kill();
            }

            await Task.Delay(500);
            _instances.TryRemove(profileId, out _);
            instance.PipeConnection?.Dispose();

            return true;
        }
        catch { return false; }
    }

    public BrowserInstance? GetInstance(int profileId)
    {
        _instances.TryGetValue(profileId, out var instance);
        return instance;
    }

    public IReadOnlyDictionary<int, BrowserInstance> GetAllInstances() => _instances;

    private static string? TryGetStartUrl(string profileData)
    {
        try
        {
            var cfg = JsonSerializer.Deserialize<ProfileDataConfig>(profileData);
            return cfg?.Profile?.StartURL;
        }
        catch { return null; }
    }

    public void Dispose()
    {
        foreach (var instance in _instances.Values)
        {
            try
            {
                if (!instance.Process.HasExited)
                    instance.Process.Kill();
                instance.PipeConnection?.Dispose();
            }
            catch { }
        }
        _instances.Clear();
    }

    /// <summary>
    /// T1.6: Generate HMAC-SHA256 token for pipe handshake.
    /// Token = HMAC-SHA256(key=hmacKey, message="{timestamp}:{nonce}:{profileId}")
    /// Browser verifies timestamp freshness (max 30 seconds) and signature.
    /// </summary>
    public static string GenerateHmacToken(string hmacKey, string profileId, out string timestamp)
    {
        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        string nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(8));
        string message = $"{timestamp}:{nonce}:{profileId}";

        byte[] keyBytes = Encoding.UTF8.GetBytes(hmacKey);
        byte[] msgBytes = Encoding.UTF8.GetBytes(message);

        using var hmac = new HMACSHA256(keyBytes);
        byte[] hash = hmac.ComputeHash(msgBytes);
        string sig = Convert.ToHexString(hash).ToLowerInvariant();

        return $"{timestamp}:{nonce}:{sig}";
    }

    /// <summary>
    /// T1.6: Verify HMAC token on the backend side.
    /// </summary>
    public static bool VerifyHmacToken(string hmacKey, string token, string profileId)
    {
        var parts = token.Split(':');
        if (parts.Length != 3) return false;

        var timestamp = parts[0];
        var nonce = parts[1];
        var sig = parts[2];
        var message = $"{timestamp}:{nonce}:{profileId}";

        byte[] keyBytes = Encoding.UTF8.GetBytes(hmacKey);
        byte[] msgBytes = Encoding.UTF8.GetBytes(message);

        using var hmac = new HMACSHA256(keyBytes);
        byte[] hash = hmac.ComputeHash(msgBytes);
        string expected = Convert.ToHexString(hash).ToLowerInvariant();

        if (sig != expected) return false;

        // Verify timestamp freshness (max 30 seconds)
        if (long.TryParse(timestamp, out long ts))
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (Math.Abs(now - ts) > 30) return false;
        }
        else return false;

        return true;
    }
}

public class BrowserInstance
{
    public int ProfileId { get; set; }
    public Process Process { get; set; } = null!;
    public int CdpPort { get; set; }
    public DuckBrowserPipeConnection? PipeConnection { get; set; }
    public bool IsRunning => !Process.HasExited;
}

public class BrowserLaunchResult
{
    public bool Success { get; set; }
    public int ProfileId { get; set; }
    public int CdpPort { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Connection to DuckBrowser's Named Pipe using the proper frame format
/// Format: \x1E type \x1F profileId \x1F data \x1E
/// </summary>
public class DuckBrowserPipeConnection : IDisposable
{
    private const char FrameDelim = '\x1E';
    private const char FieldDelim = '\x1F';

    private readonly string _pipeName;
    private NamedPipeClientStream? _pipe;
    private bool _disposed;
    private readonly object _lock = new();

    public bool IsConnected => _pipe?.IsConnected ?? false;

    public DuckBrowserPipeConnection(string pipeName)
    {
        _pipeName = pipeName;
    }

    public async Task<bool> ConnectAsync(int timeoutMs)
    {
        try
        {
            _pipe = new NamedPipeClientStream(
                ".",
                _pipeName,
                PipeDirection.InOut,
                PipeOptions.Asynchronous);

            var connectTask = _pipe.ConnectAsync(timeoutMs);
            var completedTask = await Task.WhenAny(connectTask, Task.Delay(timeoutMs));

            if (completedTask == connectTask && _pipe.IsConnected)
                return true;

            return false;
        }
        catch { return false; }
    }

    public async Task<bool> SendFramedMessageAsync(string type, string profileId, string data)
    {
        if (_pipe == null || !_pipe.IsConnected)
            return false;

        try
        {
            var framed = new StringBuilder();
            framed.Append(FrameDelim);
            framed.Append(type);
            framed.Append(FieldDelim);
            framed.Append(EscapeField(profileId));
            framed.Append(FieldDelim);
            framed.Append(EscapeField(data));
            framed.Append(FrameDelim);

            var bytes = Encoding.UTF8.GetBytes(framed.ToString());
            await _pipe.WriteAsync(bytes, 0, bytes.Length);
            await _pipe.FlushAsync();
            return true;
        }
        catch { return false; }
    }

    public async Task<DuckPipeMessage?> ReceiveMessageAsync(int timeoutMs)
    {
        if (_pipe == null || !_pipe.IsConnected)
            return null;

        try
        {
            var buffer = new byte[65536];
            var frameBuffer = new List<byte>();
            var startTime = DateTime.Now;
            var readTask = _pipe.ReadAsync(buffer, 0, buffer.Length);

            while ((DateTime.Now - startTime).TotalMilliseconds < timeoutMs)
            {
                if (readTask.IsCompleted)
                {
                    var bytesRead = readTask.Result;
                    if (bytesRead > 0)
                    {
                        for (int i = 0; i < bytesRead; i++)
                            frameBuffer.Add(buffer[i]);

                        var frameStr = Encoding.UTF8.GetString(frameBuffer.ToArray());
                        var startIdx = frameStr.IndexOf(FrameDelim);
                        var endIdx = frameStr.LastIndexOf(FrameDelim);

                        if (startIdx >= 0 && endIdx > startIdx)
                        {
                            var frameContent = frameStr.Substring(startIdx + 1, endIdx - startIdx - 1);
                            return ParseFrame(frameContent);
                        }
                    }
                    readTask = _pipe.ReadAsync(buffer, 0, buffer.Length);
                }

                await Task.Delay(50);
            }

            return null;
        }
        catch { return null; }
    }

    private DuckPipeMessage ParseFrame(string frameContent)
    {
        var message = new DuckPipeMessage();

        var parts = frameContent.Split(FieldDelim);

        if (parts.Length >= 1)
            message.Type = parts[0];
        if (parts.Length >= 2)
            message.ProfileId = UnescapeField(parts[1]);
        if (parts.Length >= 3)
            message.Data = UnescapeField(parts[2]);

        if (!string.IsNullOrEmpty(message.Data))
        {
            try
            {
                var json = JsonSerializer.Deserialize<JsonElement>(message.Data);

                if (json.TryGetProperty("cdpUrl", out var cdpUrl))
                    message.CdpUrl = cdpUrl.GetString();
                if (json.TryGetProperty("sessionId", out var sessionId))
                    message.SessionId = sessionId.GetString();
                if (json.TryGetProperty("port", out var port))
                    message.CdpPort = port.GetInt32();
                if (json.TryGetProperty("cdpPort", out var cdpPort))
                    message.CdpPort = cdpPort.GetInt32();
            }
            catch { }
        }

        return message;
    }

    private static string EscapeField(string s)
    {
        var sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == FrameDelim || c == FieldDelim || c == '\\')
                sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }

    private static string UnescapeField(string s)
    {
        var sb = new StringBuilder();
        for (int i = 0; i < s.Length; i++)
        {
            if (s[i] == '\\' && i + 1 < s.Length)
            {
                sb.Append(s[i + 1]);
                i++;
            }
            else
            {
                sb.Append(s[i]);
            }
        }
        return sb.ToString();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _pipe?.Dispose();
    }
}

public class DuckPipeMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("profileId")]
    public string? ProfileId { get; set; }

    [JsonPropertyName("profileName")]
    public string? ProfileName { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("cdpUrl")]
    public string? CdpUrl { get; set; }

    [JsonPropertyName("cdpPort")]
    public int? CdpPort { get; set; }

    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    [JsonPropertyName("data")]
    public string? Data { get; set; }
}

[JsonSerializable(typeof(DuckPipeMessage))]
[JsonSerializable(typeof(DuckBrowserConfig))]
[JsonSerializable(typeof(DuckProfileConfig))]
[JsonSerializable(typeof(DuckSystemConfig))]
[JsonSerializable(typeof(DuckScreenConfig))]
[JsonSerializable(typeof(DuckTouchConfig))]
[JsonSerializable(typeof(DuckFingerprintConfig))]
[JsonSerializable(typeof(DuckWebGLConfig))]
[JsonSerializable(typeof(DuckWebGL2Config))]
[JsonSerializable(typeof(DuckCanvasConfig))]
[JsonSerializable(typeof(DuckAudioConfig))]
[JsonSerializable(typeof(DuckFontMetricsConfig))]
[JsonSerializable(typeof(DuckClientRectsConfig))]
[JsonSerializable(typeof(DuckFontsConfig))]
[JsonSerializable(typeof(DuckNavigatorConfig))]
[JsonSerializable(typeof(DuckTlsConfig))]
[JsonSerializable(typeof(DuckWebRtcConfig))]
[JsonSerializable(typeof(DuckDnsConfig))]
[JsonSerializable(typeof(DuckSpeechConfig))]
[JsonSerializable(typeof(DuckSecurityConfig))]
[JsonSerializable(typeof(DuckFingerprintSecurityConfig))]
[JsonSerializable(typeof(DuckNetworkConfig))]
[JsonSerializable(typeof(DuckLocationConfig))]
[JsonSerializable(typeof(DuckUiConfig))]
[JsonSerializable(typeof(DuckFileSystemConfig))]
[JsonSerializable(typeof(DuckResourceLimitsConfig))]
[JsonSerializable(typeof(DuckProxyConfig))]
[JsonSerializable(typeof(DuckConnectionConfig))]
[JsonSerializable(typeof(DuckMediaDevicesConfig))]
[JsonSerializable(typeof(DuckStorageConfig))]
[JsonSerializable(typeof(DuckPluginConfig))]
[JsonSerializable(typeof(DuckHeadlessConfig))]
[JsonSerializable(typeof(DuckWindowSizeConfig))]
[JsonSerializable(typeof(DuckShaderSourceConfig))]
[JsonSerializable(typeof(DuckWebGLImageSpoofing))]
[JsonSerializable(typeof(DuckSpeechVoiceConfig))]
[JsonSerializable(typeof(DuckSecurityProcessConfig))]
[JsonSerializable(typeof(DuckSecurityWindowConfig))]
[JsonSerializable(typeof(DuckSecurityDevToolsConfig))]
[JsonSerializable(typeof(DuckSecurityConsoleConfig))]
[JsonSerializable(typeof(DuckSecurityNodeGlobalsConfig))]
[JsonSerializable(typeof(DuckSecurityProtoGuardConfig))]
[JsonSerializable(typeof(DuckSecurityCssAnimationConfig))]
[JsonSerializable(typeof(DuckSecurityChromeInternalConfig))]
[JsonSerializable(typeof(DuckSecurityFeatureDetectionConfig))]
[JsonSerializable(typeof(DuckSecurityScriptConfig))]
[JsonSerializable(typeof(DuckSecurityDeviceConfig))]
[JsonSerializable(typeof(DuckSecurityNotificationConfig))]
[JsonSerializable(typeof(DuckSecurityBlobUrlConfig))]
[JsonSerializable(typeof(DuckSecurityCssSupportsConfig))]
[JsonSerializable(typeof(DuckSecurityEvalInvariantsConfig))]
[JsonSerializable(typeof(JsonElement))]
internal partial class DuckPipeMessageContext : JsonSerializerContext { }
