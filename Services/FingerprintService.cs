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
        string? webglRenderer = null)
    {
        var tmpl = await LoadTemplatesAsync();

        // Pick OS
        var osKey = platform ?? tmpl.OS.Keys.ToList()[Random.Shared.Next(tmpl.OS.Count)];
        if (!tmpl.OS.TryGetValue(osKey, out var osTmpl))
            osTmpl = tmpl.OS.Values.First();

        // Pick OS model
        var osModel = osModelName != null
            ? osTmpl.Models.FirstOrDefault(m => m.Name == osModelName) ?? osTmpl.Models.First()
            : osTmpl.Models[Random.Shared.Next(osTmpl.Models.Count)];

        // Browser version (default Chromium 138)
        var version = "138";
        var ua = osModel.UserAgentTemplate.Replace("{VERSION}", version);

        // Screen
        var screenPreset = screenWidth.HasValue && screenHeight.HasValue
            ? new ScreenPreset { Width = screenWidth.Value, Height = screenHeight.Value, PixelRatio = pixelRatio ?? 1.0 }
            : osTmpl.ScreenPresets[Random.Shared.Next(osTmpl.ScreenPresets.Count)];

        // Hardware tier
        var hwTier = osTmpl.HardwareTiers[Random.Shared.Next(osTmpl.HardwareTiers.Count)];

        // Timezone
        var tz = timezone ?? tmpl.Timezones[Random.Shared.Next(tmpl.Timezones.Count)];

        // Languages
        var langs = languages?.Count > 0 ? languages : new List<string> { "en-US", "en" };
        var acceptLang = string.Join(",", langs);

        // WebGL GPU — pick a vendor first, then pick a renderer from that vendor
        string gpuVendor;
        string gpuRenderer;
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
            gpuRenderer = renderers[Random.Shared.Next(renderers.Count)];
        }
        else
        {
            var vendors = osTmpl.WebGL.VendorGPUs.Keys.ToList();
            gpuVendor = vendors[Random.Shared.Next(vendors.Count)];
            var renderers = osTmpl.WebGL.VendorGPUs[gpuVendor];
            gpuRenderer = renderers[Random.Shared.Next(renderers.Count)];
        }

        // Noise seeds
        var canvasSeed = Guid.NewGuid().ToString("N")[..12];
        var audioSeed = Guid.NewGuid().ToString("N")[..12];
        var fontSeed  = Guid.NewGuid().ToString("N")[..12];
        var rectsSeed = Guid.NewGuid().ToString("N")[..12];
        var webglSeed = Guid.NewGuid().ToString("N")[..12];

            // Randomize noise levels within reasonable ranges to make each profile unique
            var webglNoiseLevel = RandomizeNoiseLevel(0.0001, 0.00005, 0.0002);    // ±50% around 0.0001
            var canvasNoiseLevel = RandomizeNoiseLevel(0.00008, 0.00004, 0.00015);   // ±50% around 0.00008
            var audioNoiseLevel = RandomizeNoiseLevel(0.000001, 0.0000005, 0.000002); // ±50% around 0.000001
            var fontNoiseLevel = RandomizeNoiseLevel(0.0001, 0.00005, 0.0002);       // ±50% around 0.0001
            var rectsNoiseLevel = RandomizeNoiseLevel(0.000025, 0.00001, 0.00005);   // ±50% around 0.000025

            return new ProfileDataConfig
            {
                System = new SystemConfig
                {
                    Platform              = osModel.PlatformString,
                    Language             = langs.FirstOrDefault() ?? "en-US",
                    UserAgent           = ua,
                    AcceptLanguage      = acceptLang,
                    Timezone            = tz,
                    HardwareConcurrency = hwTier.Concurrency,
                    DeviceMemory        = hwTier.Memory,
                    Architecture        = osModel.Architecture,
                    Bitness             = osModel.Bitness,
                    Screen = new ScreenConfig
                    {
                        Width      = screenPreset.Width,
                        Height     = screenPreset.Height,
                        ColorDepth = 24,
                        PixelRatio = screenPreset.PixelRatio
                    }
                },
                Fingerprint = new FingerprintConfig
                {
                    TLSOSMatch  = osModel.TLSOSMatch,
                    Fonts       = osTmpl.Fonts.Take(Random.Shared.Next(osTmpl.Fonts.Count / 2, osTmpl.Fonts.Count)).ToList(),
                    WebGL = new WebGLConfig
                    {
                        Mode       = "Noise",
                        Vendor     = gpuVendor,
                        Renderer   = gpuRenderer,
                        NoiseSeed  = webglSeed,
                        NoiseLevel = webglNoiseLevel,
                        ImageSpoofing = new ImageSpoofingConfig
                        {
                            TextureSeed = Guid.NewGuid().ToString("N")[..12],
                            Pattern = "default"
                        }
                    },
                    Canvas = new CanvasConfig
                    {
                        Mode       = "Noise",
                        NoiseSeed  = canvasSeed,
                        NoiseLevel = canvasNoiseLevel
                    },
                    Audio = new AudioConfig
                    {
                        Mode       = "Noise",
                        NoiseSeed  = audioSeed,
                        NoiseLevel = audioNoiseLevel
                    },
                    FontMetrics = new FontMetricsConfig
                    {
                        Mode       = "Noise",
                        NoiseSeed  = fontSeed,
                        NoiseLevel = fontNoiseLevel
                    },
                    ClientRects = new ClientRectsConfig
                    {
                        Mode       = "Noise",
                        NoiseSeed  = rectsSeed,
                        NoiseLevel = rectsNoiseLevel
                    },
                    MediaDevices = new MediaDevicesConfig
                    {
                        Mode         = "Noise",
                        VideoInputs  = Random.Shared.Next(1, 3), // 1-2 cameras
                        AudioInputs  = Random.Shared.Next(1, 3), // 1-2 microphones
                        AudioOutputs = Random.Shared.Next(1, 3)  // 1-2 speakers
                    },
                    Connection = PickRandomConnectionPreset(osTmpl),
                    StorageQuota = osTmpl.StorageQuota,
                    DoNotTrack   = "1"
                },
                Network  = new NetworkConfig(),
                Security = new SecurityConfig(),
                Location = await BuildLocationConfigAsync(tz)
            };
        }

        private static double RandomizeNoiseLevel(double baseValue, double min, double max)
        {
            // Randomize within ±50% of base value, clamped to min/max
            var variation = (Random.Shared.NextDouble() - 0.5) * baseValue; // ±50% variation
            var result = baseValue + variation;
            return Math.Clamp(result, min, max);
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
            var selectedCategory = categories[Random.Shared.Next(categories.Count)];
            var presets = osTmpl.ConnectionTypes[selectedCategory];

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
        var (lat, lng) = await GetRandomLocationAsync(timezone, useOffset: false);
        return new LocationConfig
        {
            Mode     = "Noise",
            Latitude = lat,
            Longitude = lng,
            Accuracy = Random.Shared.Next(50, 500)
        };
    }

    public async Task<(double Lat, double Lng)> GetRandomLocationAsync(string timezone, bool useOffset = false)
    {
        if (useOffset && _cachedGeo.HasValue && DateTime.UtcNow < _geoCacheExpiry)
        {
            var b = _cachedGeo.Value;
            var dLat = (Random.Shared.NextDouble() - 0.5) * 1.0;
            var dLng = (Random.Shared.NextDouble() - 0.5) * 1.0;
            return (Math.Round(b.Lat + dLat, 6), Math.Round(b.Lng + dLng, 6));
        }

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
                if (useOffset)
                {
                    return (Math.Round(lat + (Random.Shared.NextDouble() - 0.5) * 1.0, 6),
                            Math.Round(lng + (Random.Shared.NextDouble() - 0.5) * 1.0, 6));
                }
                return (Math.Round(lat, 6), Math.Round(lng, 6));
            }
        }
        catch { }

        return GetRandomLocationFromTimezoneFallback(timezone);
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
            platform       = cfg.System?.Platform ?? "Win32",
            browserVersion = "138",
            userAgent     = cfg.System?.UserAgent ?? "",
            screen        = $"{cfg.System?.Screen.Width}x{cfg.System?.Screen.Height}",
            timezone       = cfg.System?.Timezone ?? "",
            languages      = cfg.System?.AcceptLanguage ?? "",
            hardware       = $"{cfg.System?.HardwareConcurrency} Cores, {cfg.System?.DeviceMemory}GB RAM",
            webglVendor    = cfg.Fingerprint?.WebGL.Vendor ?? "",
            webglRenderer  = cfg.Fingerprint?.WebGL.Renderer ?? "",
        };
    }

    public async Task<FingerprintSummaryResponse> GenerateStructuredAsync(
        string? platform = null,
        string? browserType = null,
        string? osModelName = null)
    {
        var cfg = await GenerateAsync(platform, browserType, osModelName);
        var langs = cfg.System?.AcceptLanguage?.Split(',').Select(l => l.Trim()).ToList() ?? new List<string> { "en-US" };
        return new FingerprintSummaryResponse(
            Platform: cfg.System?.Platform ?? "Win32",
            BrowserVersion: "138",
            UserAgent: cfg.System?.UserAgent ?? "",
            Screen: $"{cfg.System?.Screen.Width}x{cfg.System?.Screen.Height}",
            ScreenWidth: cfg.System?.Screen.Width.ToString() ?? "1920",
            ScreenHeight: cfg.System?.Screen.Height.ToString() ?? "1080",
            ScreenPixelRatio: cfg.System?.Screen.PixelRatio ?? 1.0,
            Timezone: cfg.System?.Timezone ?? "",
            AcceptLanguage: cfg.System?.AcceptLanguage ?? "en-US, en",
            Languages: langs,
            HardwareConcurrency: cfg.System?.HardwareConcurrency ?? 8,
            DeviceMemory: cfg.System?.DeviceMemory ?? 8,
            Architecture: cfg.System?.Architecture ?? "x86",
            Bitness: cfg.System?.Bitness ?? "64",
            WebGLVendor: cfg.Fingerprint?.WebGL.Vendor ?? "",
            WebGLRenderer: cfg.Fingerprint?.WebGL.Renderer ?? "",
            WebGLMode: "Noise",
            WebGLNoiseLevel: cfg.Fingerprint?.WebGL.NoiseLevel,
            CanvasMode: "Noise",
            CanvasNoiseLevel: cfg.Fingerprint?.Canvas.NoiseLevel,
            WebGLImageMode: "Noise",
            ImageSpoofingTextureSeed: cfg.Fingerprint?.WebGL.ImageSpoofing?.TextureSeed,
            ImageSpoofingPattern: cfg.Fingerprint?.WebGL.ImageSpoofing?.Pattern ?? "default",
            PluginsMode: "Noise",
            FontsMode: "Random",
            Fonts: cfg.Fingerprint?.Fonts ?? new List<string>(),
            WebRTcMode: "Alter",
            SslMode: "Noise",
            PortScan: "Protect",
            PortBlockMode: "BlockDefault",
            PortBlockList: new List<string>(),
            MediaDevicesMode: "Noise",
            MediaVideoInputs: cfg.Fingerprint?.MediaDevices.VideoInputs,
            MediaAudioInputs: cfg.Fingerprint?.MediaDevices.AudioInputs,
            MediaAudioOutputs: cfg.Fingerprint?.MediaDevices.AudioOutputs,
            SpeechVoicesMode: "Noise",
            ClientRectsMode: "Noise",
            ClientRectsNoiseLevel: cfg.Fingerprint?.ClientRects.NoiseLevel,
            PlatformString: cfg.System?.Platform ?? "Win32",
            TLSOSMatch: cfg.Fingerprint?.TLSOSMatch ?? "",
            ConnectionType: cfg.Fingerprint?.Connection?.EffectiveType ?? "4g",
            ConnectionDownlink: cfg.Fingerprint?.Connection?.Downlink,
            ConnectionRtt: cfg.Fingerprint?.Connection?.Rtt,
            StorageQuota: cfg.Fingerprint?.StorageQuota
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
}
