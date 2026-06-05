using System.IO;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using DuckGo.Models.Configs;

namespace DuckGo.Services;

public class FingerprintService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly string _assetPath;
    private FingerprintTemplate? _templates;

    public FingerprintService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        _assetPath = Path.Combine(appData, "DuckGo", "fingerprint", "default_fingerprint.json");
    }

    // Allow injection of path for testing
    public FingerprintService(string assetPath)
    {
        _assetPath = assetPath;
    }

    private async Task<FingerprintTemplate> LoadTemplatesAsync()
    {
        if (_templates != null) return _templates;

        var dir = Path.GetDirectoryName(_assetPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        // Bootstrap: copy from embedded resource to AppData if missing
        if (!File.Exists(_assetPath))
        {
            var assembly = Assembly.GetExecutingAssembly();
            var resourceName = "DuckGo.Assets.default_fingerprint.json";
            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream != null)
            {
                using var outStream = File.Create(_assetPath);
                await stream.CopyToAsync(outStream);
            }
            else
            {
                throw new FileNotFoundException(
                    $"Fingerprint template not found at {_assetPath} and embedded resource '{resourceName}' not found.");
            }
        }

        var json = await File.ReadAllTextAsync(_assetPath);
        _templates = FingerprintTemplate.FromJson(json);
        return _templates;
    }

    public FingerprintService(FingerprintTemplate templates)
    {
        _assetPath = "";
        _templates = templates;
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
            // Find the vendor that owns this renderer
            gpuVendor = osTmpl.WebGL.VendorGPUs
                .FirstOrDefault(kvp => kvp.Value.Contains(webglRenderer))
                .Key ?? osTmpl.WebGL.VendorGPUs.Keys.ElementAt(Random.Shared.Next(osTmpl.WebGL.VendorGPUs.Count));
            gpuRenderer = webglRenderer;
        }
        else if (webglVendor != null)
        {
            // Match by vendor name fragment (case-insensitive)
            gpuVendor = osTmpl.WebGL.VendorGPUs.Keys
                .FirstOrDefault(v => v.Contains(webglVendor, StringComparison.OrdinalIgnoreCase))
                ?? osTmpl.WebGL.VendorGPUs.Keys.ElementAt(Random.Shared.Next(osTmpl.WebGL.VendorGPUs.Count));
            var renderers = osTmpl.WebGL.VendorGPUs[gpuVendor];
            gpuRenderer = renderers[Random.Shared.Next(renderers.Count)];
        }
        else
        {
            // Full random: pick vendor weighted by renderers, then pick renderer from that vendor
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

        return new ProfileDataConfig
        {
            System = new SystemConfig
            {
                Platform          = osModel.PlatformString,
                Language          = langs.FirstOrDefault() ?? "en-US",
                UserAgent         = ua,
                AcceptLanguage    = acceptLang,
                Timezone          = tz,
                HardwareConcurrency = hwTier.Concurrency,
                DeviceMemory      = hwTier.Memory,
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
                    NoiseLevel = 0.0001
                },
                Canvas = new CanvasConfig
                {
                    Mode       = "Noise",
                    NoiseSeed  = canvasSeed,
                    NoiseLevel = 0.00008
                },
                Audio = new AudioConfig
                {
                    Mode       = "Noise",
                    NoiseSeed  = audioSeed,
                    NoiseLevel = 0.000001
                },
                FontMetrics = new FontMetricsConfig
                {
                    Mode       = "Noise",
                    NoiseSeed  = fontSeed,
                    NoiseLevel = 0.0001
                },
                ClientRects = new ClientRectsConfig
                {
                    Mode       = "Noise",
                    NoiseSeed  = rectsSeed,
                    NoiseLevel = 0.000025
                },
                MediaDevices = new MediaDevicesConfig
                {
                    Mode         = "Noise",
                    VideoInputs  = 1,
                    AudioInputs  = 1,
                    AudioOutputs = 1
                },
                Connection = new ConnectionConfig
                {
                    Mode         = "Noise",
                    EffectiveType = "4g",
                    Downlink     = 10.0,
                    Rtt          = 50
                },
                StorageQuota = 549755813888,
                DoNotTrack   = "1"
            },
            Network = new NetworkConfig(),
            Security = new SecurityConfig(),
            Location = new LocationConfig
            {
                Mode     = "Noise",
                Latitude = 40.7128,
                Longitude = -74.0060,
                Accuracy = 100
            }
        };
    }

    /// <summary>
    /// Generate a fingerprint and return it as a JSON-serializable summary for the UI.
    /// </summary>
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
}
