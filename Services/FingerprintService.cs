using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class FingerprintService
{
    private static readonly HttpClient _geoClient;
    private static readonly HttpClient _assetClient;

    private const string EmbeddedFingerprintResourceName = "DuckGo.Assets.default_fingerprint.json";

    /// <summary>Static cached template — shared across all instances. Loaded once at startup.</summary>
    private static FingerprintTemplate? _cachedTemplate;
    private static readonly object _cacheLock = new();

    static FingerprintService()
    {
        var assetHandler = new HttpClientHandler
        {
            UseProxy = true,
            Proxy = WebRequest.DefaultWebProxy
        };
        var geoHandler = new HttpClientHandler
        {
            UseProxy = true,
            Proxy = WebRequest.DefaultWebProxy
        };
        _geoClient = new HttpClient(geoHandler) { Timeout = TimeSpan.FromSeconds(5) };
        _assetClient = new HttpClient(assetHandler) { Timeout = TimeSpan.FromSeconds(30) };
    }

    private static (double Lat, double Lng)? _cachedGeo = null;
    private static DateTime _geoCacheExpiry = DateTime.MinValue;

    private FingerprintTemplate? _templates;

    /// <summary>
    /// Synchronously load the cached template from embedded resource.
    /// Falls back to null if loading fails — callers handle null gracefully.
    /// </summary>
    public static FingerprintTemplate? GetCachedTemplateSync()
    {
        if (_cachedTemplate != null) return _cachedTemplate;
        lock (_cacheLock)
        {
            if (_cachedTemplate != null) return _cachedTemplate;
            try
            {
                var assembly = typeof(FingerprintService).Assembly;
                using var stream = assembly.GetManifestResourceStream(EmbeddedFingerprintResourceName);
                if (stream == null) return null;
                using var reader = new StreamReader(stream);
                var json = reader.ReadToEnd();
                _cachedTemplate = FingerprintTemplate.FromJson(json);
                return _cachedTemplate;
            }
            catch
            {
                return null;
            }
        }
    }

    /// <summary>
    /// Create a service that fetches fingerprint template from HTTP.
    /// </summary>
    public FingerprintService() { }

    /// <summary>
    /// Create a service with a pre-loaded template (useful for testing).
    /// </summary>
    public FingerprintService(FingerprintTemplate templates)
    {
        _templates = templates;
    }

    private async Task<FingerprintTemplate> LoadTemplatesAsync()
    {
        if (_templates != null) {
            FSLog("CACHE_HIT", $"_templates already loaded: {_templates.OS.Count} OSes");
            return _templates;
        }
        // Load from embedded resource first (local, instant)
        try
        {
            var assembly = typeof(FingerprintService).Assembly;
            using var stream = assembly.GetManifestResourceStream(EmbeddedFingerprintResourceName);
            if (stream != null)
            {
                using var reader = new StreamReader(stream);
                var json = await reader.ReadToEndAsync();
                _templates = FingerprintTemplate.FromJson(json);
                FSLog("EMBEDDED_OK", $"Loaded from embedded resource: {_templates.OS.Count} OSes");
                return _templates;
            }
        }
        catch (Exception ex)
        {
            FSLog("EMBEDDED_FAIL", $"Embedded load failed: {ex.Message}, trying GitHub...");
        }
        // Fallback to GitHub (may timeout in restricted networks)
        try
        {
            FSLog("FETCH_START", $"Fetching {AppConfig.FingerprintTemplateUrl}");
            var json = await _assetClient.GetStringAsync(AppConfig.FingerprintTemplateUrl);
            FSLog("JSON_RECEIVED", $"JSON len={json.Length}, first 80: {json.Substring(0, Math.Min(80, json.Length))}");
            _templates = FingerprintTemplate.FromJson(json);
            FSLog("PARSE_SUCCESS", $"_templates={_templates.Timezones.Count} TZs, {_templates.Languages.Count} LGs, {_templates.OS.Count} OSes");
            return _templates;
        }
        catch (Exception ex)
        {
            FSLog("PARSE_FAIL", $"Error: {ex.Message}");
            throw;
        }
    }

    public async Task<FingerprintTemplate> GetTemplatesAsync() => await LoadTemplatesAsync();

    /// <summary>
    /// Generate a complete ProfileDataConfig from platform/browser options.
    /// If no platform is specified, picks a random one from the template.
    /// </summary>
    public async Task<ProfileDataConfig> GenerateAsync(
        string? platform = null,
        string? browserType = null,
        string? osModelName = null,
        int? screenWidth = null,
        int? screenHeight = null,
        double? pixelRatio = null,
        string? timezone = null,
        List<string>? languages = null,
        string? webglVendor = null,
        string? webglRenderer = null,
        string? browserVersion = null)
    {
        var tmpl = await LoadTemplatesAsync();

        // Pick OS
        var osKey = platform ?? (tmpl.OS.Count > 0 ? tmpl.OS.Keys.ToList()[Random.Shared.Next(tmpl.OS.Count)] : "Windows");
        if (!tmpl.OS.TryGetValue(osKey, out var osTmpl))
            osTmpl = tmpl.OS.Values.FirstOrDefault() ?? new OsTemplate();

        // Pick OS model
        var osModel = osModelName != null
            ? osTmpl.Models?.FirstOrDefault(m => m.Name == osModelName) ?? osTmpl.Models?.FirstOrDefault() ?? new OsModel { Name = "Default", UserAgentTemplate = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/{VERSION}.0.0.0 Safari/537.36" }
            : (osTmpl.Models?.Count > 0 ? osTmpl.Models[Random.Shared.Next(osTmpl.Models.Count)] : new OsModel { Name = "Default", UserAgentTemplate = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/{VERSION}.0.0.0 Safari/537.36" });

        // Browser version (default Chromium 138)
        var version = browserVersion ?? "138";
        var ua = osModel.UserAgentTemplate.Replace("{VERSION}", version);

        if (!string.IsNullOrEmpty(browserType) && browserType.Equals("Firefox", StringComparison.OrdinalIgnoreCase))
        {
            // Simple Firefox UA spoofing for testing
            ua = $"Mozilla/5.0 ({osModel.Name}; rv:{version}.0) Gecko/20100101 Firefox/{version}.0";
        }

        // Screen
        var screenPreset = screenWidth.HasValue && screenHeight.HasValue
            ? new ScreenPreset { Width = screenWidth.Value, Height = screenHeight.Value, PixelRatio = pixelRatio ?? 1.0 }
            : (osTmpl.ScreenPresets?.Count > 0 ? osTmpl.ScreenPresets[Random.Shared.Next(osTmpl.ScreenPresets.Count)] : new ScreenPreset { Width = 1920, Height = 1080, PixelRatio = 1.0 });

        // Hardware tier
        var hwTier = osTmpl.HardwareTiers?.Count > 0 ? osTmpl.HardwareTiers[Random.Shared.Next(osTmpl.HardwareTiers.Count)] : new HardwareTier { Concurrency = 4, Memory = 8 };

        // Timezone
        var tz = timezone ?? (tmpl.Timezones?.Count > 0 ? tmpl.Timezones[Random.Shared.Next(tmpl.Timezones.Count)] : "UTC");

        // Languages
        var langs = languages?.Count > 0 ? languages : new List<string> { "en-US", "en" };
        var acceptLang = string.Join(",", langs);

        // WebGL GPU — pick a vendor first, then pick a renderer from that vendor
        string gpuVendor = "Google Inc. (NVIDIA)";
        string gpuRenderer = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)";
        if (osTmpl.WebGL?.VendorGPUs != null && osTmpl.WebGL.VendorGPUs.Count > 0)
        {
            if (webglRenderer != null)
            {
                gpuVendor = osTmpl.WebGL.VendorGPUs
                    .FirstOrDefault(kvp => kvp.Value.Contains(webglRenderer))
                    .Key ?? osTmpl.WebGL.VendorGPUs.Keys.ElementAt(Random.Shared.Next(osTmpl.WebGL.VendorGPUs.Count));
                gpuRenderer = webglRenderer;
            }
            else if (webglVendor != null)
            {
                gpuVendor = osTmpl.WebGL.VendorGPUs.Keys
                    .FirstOrDefault(v => v.Contains(webglVendor, StringComparison.OrdinalIgnoreCase))
                    ?? osTmpl.WebGL.VendorGPUs.Keys.ElementAt(Random.Shared.Next(osTmpl.WebGL.VendorGPUs.Count));
                var renderers = osTmpl.WebGL.VendorGPUs[gpuVendor];
                gpuRenderer = renderers.Count > 0 ? renderers[Random.Shared.Next(renderers.Count)] : "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080)";
            }
            else
            {
                var vendors = osTmpl.WebGL.VendorGPUs.Keys.ToList();
                gpuVendor = vendors[Random.Shared.Next(vendors.Count)];
                var renderers = osTmpl.WebGL.VendorGPUs[gpuVendor];
                gpuRenderer = renderers.Count > 0 ? renderers[Random.Shared.Next(renderers.Count)] : "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080)";
            }
        }

        // Noise seeds
        var canvasSeed = Guid.NewGuid().ToString("N")[..12];
        var audioSeed = Guid.NewGuid().ToString("N")[..12];
        var fontSeed  = Guid.NewGuid().ToString("N")[..12];
        var rectsSeed = Guid.NewGuid().ToString("N")[..12];
        var webglSeed = Guid.NewGuid().ToString("N")[..12];

        // Use exact noise levels from the plan (do not randomize the bounds)
        var webglNoiseLevel = 0.0001;
        var canvasNoiseLevel = 0.00008;
        var audioNoiseLevel = 0.000001;
        var fontNoiseLevel = 0.0001;
        var rectsNoiseLevel = 0.000025;

            return new ProfileDataConfig
            {
                System = new SystemConfig
                {
                    BrowserVersion = version,
                    Platform = new TypedConfig<string>("noise", osModel.PlatformString),
                    Language = new TypedConfig<string>("noise", acceptLang),
                    UserAgent = new TypedConfig<string>("noise", ua),
                    AcceptLanguage = new TypedConfig<string>("noise", acceptLang),
                    Languages = langs,
                    Timezone = new TypedConfig<string>("noise", tz),
                    TimezoneOffset = GetTimezoneOffsetMinutes(tz),
                    HardwareConcurrency = new TypedConfig<int?>("noise", hwTier.Concurrency),
                    DeviceMemory = new TypedConfig<int?>("noise", hwTier.Memory),
                    Architecture = new TypedConfig<string>("noise", osModel.Architecture),
                    Bitness = new TypedConfig<string>("noise", osModel.Bitness),
                    CpuBrand = new TypedConfig<string>("noise", GetCpuBrand(osModel.Architecture)),
                    Touch = new TouchConfig
                    {
                        Mode = "noise",
                        MaxTouchPoints = 0,
                        TouchSupport = false
                    },
                    Screen = new ScreenConfig
                    {
                        Mode = "noise",
                        Width = screenPreset.Width,
                        Height = screenPreset.Height,
                        ColorDepth = 24,
                        PixelRatio = screenPreset.PixelRatio,
                        AvailWidth = screenPreset.Width,
                        AvailHeight = screenPreset.Height - 40,
                        AvailLeft = 0,
                        AvailTop = 0
                    }
                },
                Fingerprint = new FingerprintConfig
                {
                    WebGL = new WebGLConfig
                    {
                        Mode = "noise",
                        Vendor = gpuVendor,
                        Renderer = gpuRenderer,
                        NoiseSeed = webglSeed,
                        NoiseLevel = webglNoiseLevel,
                        Extensions = osTmpl.WebGL.Extensions,
                        MaxTextureSize = osTmpl.WebGL.MaxTextureSize,
                        ImageSpoofing = new ImageSpoofingConfig
                        {
                            Mode = "noise",
                            TextureSeed = Guid.NewGuid().ToString("N")[..12],
                            Pattern = "default"
                        }
                    },
                    Canvas = new CanvasConfig
                    {
                        Mode = "noise",
                        NoiseSeed = canvasSeed,
                        NoiseLevel = canvasNoiseLevel
                    },
                      Audio = new AudioConfig
                      {
                          Mode = "noise",
                          NoiseSeed = Guid.NewGuid().ToString("N")[..12],
                          NoiseLevel = audioNoiseLevel
                      },
                      FontMetrics = new FontMetricsConfig
                      {
                          Mode = "noise",
                          NoiseSeed = Guid.NewGuid().ToString("N")[..12],
                          NoiseLevel = fontNoiseLevel
                      },
                    ClientRects = new ClientRectsConfig
                    {
                        Mode = "noise",
                        NoiseSeed = rectsSeed,
                        NoiseLevel = rectsNoiseLevel
                    },
                    Fonts = new FontsConfig
                    {
                        Mode = "noise",
                        FontList = osTmpl.Fonts?.Count > 0
                            ? osTmpl.Fonts.Take(Random.Shared.Next(osTmpl.Fonts.Count / 2, osTmpl.Fonts.Count)).ToList()
                            : new List<string>()
                    },
                    Plugins = new PluginsConfig
                    {
                        Mode = "default",
                        PluginList = new List<PluginInfo>
                        {
                            new() { Name = "Chrome PDF Plugin", Filename = "internal-pdf-viewer", Description = "Portable Document Format" },
                            new() { Name = "Chrome PDF Viewer", Filename = "mhjfbmdgcfjbbpaeojofohoefgiehjai", Description = "" }
                        }
                    },
                    MediaDevices = new MediaDevicesConfig
                    {
                        Mode = "noise",
                        VideoInputs = 1,
                        AudioInputs = 2,
                        AudioOutputs = 2
                    },
                    Connection = PickRandomConnectionPreset(osTmpl),
                    StorageQuota = new TypedConfig<long?>("noise", osTmpl.StorageQuota),
                    TLSOSMatch = new TypedConfig<string>("noise", osModel.TLSOSMatch),
                    DoNotTrack = new DoNotTrackConfig { Mode = "real", Value = null }
                },
                Network = new NetworkConfig(),
                Security = new SecurityConfig(),
                Location = await BuildLocationConfigAsync(tz),
                UI = new UIConfig
                {
                    Mode = "GUI",
                    WindowSize = new WindowSizeConfig
                    {
                        Width = screenPreset.Width,
                        Height = screenPreset.Height
                    }
                }
            };
        }

        private static ConnectionConfig PickRandomConnectionPreset(OsTemplate osTmpl)
        {
            if (osTmpl.ConnectionTypes == null || osTmpl.ConnectionTypes.Count == 0)
            {
                // Fallback if no connection types defined
                return new ConnectionConfig
                {
                    Mode = "Noise",
                    EffectiveType = "wifi",
                    Downlink = 50.0,
                    Rtt = 20
                };
            }

            // Pick random connection type category (wifi, 4g, 3g, etc.)
            var categories = osTmpl.ConnectionTypes.Keys.ToList();
            var selectedCategory = categories.Count > 0 ? categories[Random.Shared.Next(categories.Count)] : "wifi";
            var presets = osTmpl.ConnectionTypes.TryGetValue(selectedCategory, out var p) ? p : null;

            if (presets == null || presets.Count == 0)
            {
                return new ConnectionConfig
                {
                    Mode = "Noise",
                    EffectiveType = selectedCategory,
                    Downlink = 10.0,
                    Rtt = 50
                };
            }

            // Pick random preset within that category
            var preset = presets[Random.Shared.Next(presets.Count)];
            return new ConnectionConfig
            {
                Mode = "Noise",
                EffectiveType = preset.EffectiveType,
                Downlink = preset.Downlink,
                Rtt = preset.Rtt
            };
        }

    private async Task<LocationConfig> BuildLocationConfigAsync(string timezone)
    {
        var (lat, lng) = await GetRealLocationAsync(timezone);
        return new LocationConfig
        {
            Mode     = "noise",
            Latitude = lat,
            Longitude = lng,
            Accuracy = Random.Shared.Next(50, 500)
        };
    }

    public async Task<(double Lat, double Lng)> GetRealLocationAsync(string timezone)
    {
        try
        {
            var json = await _geoClient.GetStringAsync("http://ip-api.com/json/");
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("status", out var st) && st.GetString() == "success")
            {
                var lat = doc.RootElement.GetProperty("lat").GetDouble();
                var lng = doc.RootElement.GetProperty("lon").GetDouble();
                _cachedGeo = (lat, lng);
                _geoCacheExpiry = DateTime.UtcNow.AddMinutes(5);
                return (Math.Round(lat, 6), Math.Round(lng, 6));
            }
        }
        catch { }

        return GetRandomLocationFromTimezoneFallback(timezone);
    }

    public async Task<(double Lat, double Lng)> GetRandomLocationAsync(string timezone, bool useOffset = false)
    {
        // useOffset=true → randomize within ~1 degree around real IP
        if (useOffset && _cachedGeo.HasValue && DateTime.UtcNow < _geoCacheExpiry)
        {
            var b = _cachedGeo.Value;
            var dLat = (Random.Shared.NextDouble() - 0.5) * 1.0;
            var dLng = (Random.Shared.NextDouble() - 0.5) * 1.0;
            return (Math.Round(b.Lat + dLat, 6), Math.Round(b.Lng + dLng, 6));
        }

        return await GetRealLocationAsync(timezone);
    }

    private (double Lat, double Lng) GetRandomLocationFromTimezoneFallback(string timezone)
    {
        if (_templates?.TimezoneGeo != null &&
            _templates.TimezoneGeo.TryGetValue(timezone, out var b))
        {
            var lat = b.LatMin + Random.Shared.NextDouble() * (b.LatMax - b.LatMin);
            var lng = b.LngMin + Random.Shared.NextDouble() * (b.LngMax - b.LngMin);
            return (Math.Round(lat, 6), Math.Round(lng, 6));
        }
        return (Math.Round(Random.Shared.NextDouble() * 180 - 90, 6),
                Math.Round(Random.Shared.NextDouble() * 360 - 180, 6));
    }

    public async Task<object> GenerateSummaryAsync(
        string? platform = null,
        string? browserType = null,
        string? osModelName = null)
    {
        var cfg = await GenerateAsync(platform, browserType, osModelName);
        return new
        {
            platform       = cfg.System?.Platform?.Value ?? "Win32",
            browserVersion = "138",
            userAgent     = cfg.System?.UserAgent?.Value ?? "",
            screen        = $"{cfg.System?.Screen.Width}x{cfg.System?.Screen.Height}",
            timezone       = cfg.System?.Timezone?.Value ?? "",
            languages      = cfg.System?.AcceptLanguage?.Value ?? "",
            hardware       = $"{cfg.System?.HardwareConcurrency?.Value} Cores, {cfg.System?.DeviceMemory?.Value}GB RAM",
            webglVendor    = cfg.Fingerprint?.WebGL.Vendor ?? "",
            webglRenderer  = cfg.Fingerprint?.WebGL.Renderer ?? "",
        };
    }

    public async Task<FingerprintSummaryResponse> GenerateStructuredAsync(
        string? platform = null,
        string? browserType = null,
        string? osModelName = null,
        string? browserVersion = null)
    {
        var cfg = await GenerateAsync(platform, browserType, osModelName, browserVersion: browserVersion);
        var langs = cfg.System?.Language?.Value?.Split(',').Select(l => l.Trim()).ToList() ?? new List<string> { "en-US" };
        return new FingerprintSummaryResponse(
            Platform: cfg.System?.Platform?.Value ?? "Win32",
            BrowserVersion: browserVersion ?? "138",
            UserAgent: cfg.System?.UserAgent?.Value ?? "",
            Screen: $"{cfg.System?.Screen.Width}x{cfg.System?.Screen.Height}",
            ScreenWidth: cfg.System?.Screen.Width.ToString() ?? "1920",
            ScreenHeight: cfg.System?.Screen.Height.ToString() ?? "1080",
            ScreenPixelRatio: cfg.System?.Screen.PixelRatio ?? 1.0,
            Timezone: cfg.System?.Timezone?.Value ?? "",
            AcceptLanguage: cfg.System?.Language?.Value ?? "en-US,en",
            Languages: langs,
            HardwareConcurrency: cfg.System?.HardwareConcurrency?.Value ?? 8,
            DeviceMemory: cfg.System?.DeviceMemory?.Value ?? 8,
            Architecture: cfg.System?.Architecture?.Value ?? "x86",
            Bitness: cfg.System?.Bitness?.Value ?? "64",
            WebGLVendor: cfg.Fingerprint?.WebGL.Vendor ?? "",
            WebGLRenderer: cfg.Fingerprint?.WebGL.Renderer ?? "",
            WebGLMode: (cfg.Fingerprint?.WebGL.Mode ?? "noise").ToLowerInvariant(),
            WebGLNoiseLevel: cfg.Fingerprint?.WebGL.NoiseLevel,
            CanvasMode: (cfg.Fingerprint?.Canvas.Mode ?? "noise").ToLowerInvariant(),
            CanvasNoiseLevel: cfg.Fingerprint?.Canvas.NoiseLevel,
            WebGLImageMode: cfg.Fingerprint?.WebGL.ImageSpoofing?.Pattern ?? "default",
            PluginsMode: (cfg.Fingerprint?.Plugins?.Mode ?? "default").ToLowerInvariant(),
            FontsMode: (cfg.Fingerprint?.Fonts?.Mode ?? "real").ToLowerInvariant(),
            Fonts: cfg.Fingerprint?.Fonts?.FontList ?? new List<string>(),
            WebRTcMode: (cfg.Fingerprint?.WebRTcMode ?? "disable").ToLowerInvariant(),
            SslMode: (cfg.Fingerprint?.SslMode ?? "noise").ToLowerInvariant(),
            PortScan: (cfg.Security?.PortScan ?? "protect").ToLowerInvariant(),
            PortBlockMode: cfg.Security?.PortBlockMode ?? "block_default",
            PortBlockList: cfg.Security?.PortBlockList ?? new List<string>(),
            MediaDevicesMode: (cfg.Fingerprint?.MediaDevices?.Mode ?? "real").ToLowerInvariant(),
            MediaVideoInputs: cfg.Fingerprint?.MediaDevices.VideoInputs,
            MediaAudioInputs: cfg.Fingerprint?.MediaDevices.AudioInputs,
            MediaAudioOutputs: cfg.Fingerprint?.MediaDevices.AudioOutputs,
            SpeechVoicesMode: (cfg.Fingerprint?.SpeechVoicesMode ?? "noise").ToLowerInvariant(),
            ClientRectsMode: (cfg.Fingerprint?.ClientRects.Mode ?? "noise").ToLowerInvariant(),
            ClientRectsNoiseLevel: cfg.Fingerprint?.ClientRects.NoiseLevel,
            PlatformString: cfg.System?.Platform?.Value ?? "Win32",
            TLSOSMatch: cfg.Fingerprint?.TLSOSMatch?.Value ?? "",
            ConnectionType: cfg.Fingerprint?.Connection?.EffectiveType ?? "4g",
            ConnectionDownlink: cfg.Fingerprint?.Connection?.Downlink,
            ConnectionRtt: cfg.Fingerprint?.Connection?.Rtt,
            StorageQuota: cfg.Fingerprint?.StorageQuota?.Value,
            RawConfig: cfg
        );
    }

    private static void FSLog(string evt, string msg)
    {
        try
        {
            var log = new
            {
                sessionId = "971020",
                ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                evt,
                msg,
                src = "FingerprintService"
            };
            var path = @"d:\Software\DuckAutomation\DuckGo\fs-log-971020.log";
            File.AppendAllText(path, JsonSerializer.Serialize(log) + "\n");
        }
        catch { }
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
}
