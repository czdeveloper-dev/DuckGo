using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

// Template models mapped from default_fingerprint.json (data populated by FingerprintService at runtime)
public class FingerprintTemplate
{
    public Dictionary<string, OsTemplate> OS { get; set; } = new();
    public List<string> Timezones { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public Dictionary<string, GeoBounds> TimezoneGeo { get; set; } = new();
    public Dictionary<string, List<ConnectionPreset>> ConnectionTypes { get; set; } = new();
    public long StorageQuota { get; set; } = 549755813888; // Default 512GB

    /// <summary>
    /// Deserializes from a JSON string that has OS keys (Windows, macOS, Linux...)
    /// as top-level keys — not wrapped in an "OS" object.
    /// Uses JsonNode to read the dynamic structure, then deserializes the OS sub-tree.
    /// </summary>
    public static FingerprintTemplate FromJson(string json)
    {
        var node = JsonNode.Parse(json);
        var tmpl = new FingerprintTemplate();

        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        if (node?["Languages"] is JsonArray langArr)
            tmpl.Languages = langArr.Select(x => x!.GetValue<string>()).ToList();

        // TimezoneGeo: read timezone→bounds mapping
        if (node?["TimezoneGeo"] is JsonObject geoObj)
        {
            foreach (var kvp in geoObj)
            {
                if (kvp.Value is JsonObject bounds)
                {
                    tmpl.TimezoneGeo[kvp.Key] = new GeoBounds
                    {
                        LatMin = bounds["LatMin"]?.GetValue<double>() ?? 0,
                        LatMax = bounds["LatMax"]?.GetValue<double>() ?? 0,
                        LngMin = bounds["LngMin"]?.GetValue<double>() ?? 0,
                        LngMax = bounds["LngMax"]?.GetValue<double>() ?? 0,
                    };
                }
            }
        }

        // Derive Timezones list from TimezoneGeo keys (for frontend dropdown)
        tmpl.Timezones = tmpl.TimezoneGeo.Keys.OrderBy(k => k).ToList();

        if (node is JsonObject obj)
        {
            foreach (var kvp in obj)
            {
                // Skip arrays and metadata sections
                if (kvp.Value is JsonArray || kvp.Key is "Timezones" or "Languages" or "TimezoneGeo")
                    continue;

                // Everything else is treated as an OS block (Windows, macOS, Linux...)
                if (kvp.Value is JsonObject osBlock)
                {
                    try
                    {
                        // First deserialize to get the OsTemplate object
                        var osJson = JsonSerializer.Serialize(osBlock);
                        var osTemplate = JsonSerializer.Deserialize<OsTemplate>(osJson, opts);

                        // Check if this OS block has ConnectionTypes (OS-specific)
                        if (osTemplate != null && osBlock.TryGetPropertyValue("ConnectionTypes", out var osConnTypes) && osConnTypes is JsonObject connObj)
                        {
                            // This OS has its own ConnectionTypes - parse them into OsTemplate
                            foreach (var cKvp in connObj)
                            {
                                if (cKvp.Value is JsonArray presets)
                                {
                                    var list = new List<ConnectionPreset>();
                                    foreach (var preset in presets)
                                    {
                                        if (preset is JsonObject p)
                                        {
                                            list.Add(new ConnectionPreset
                                            {
                                                EffectiveType = p["EffectiveType"]?.GetValue<string>() ?? "4g",
                                                Downlink = p["Downlink"]?.GetValue<double>() ?? 10.0,
                                                Rtt = p["Rtt"]?.GetValue<int>() ?? 50
                                            });
                                        }
                                    }
                                    osTemplate.ConnectionTypes[cKvp.Key] = list;
                                }
                            }
                        }

                        if (osTemplate != null)
                        {
                            // Parse Architecture/Bitness per model (OsModel uses default case-sensitive deserialize)
                            if (osBlock["Models"] is JsonArray modelsArr)
                            {
                                for (int i = 0; i < modelsArr.Count; i++)
                                {
                                    if (modelsArr[i] is JsonObject modelObj && i < osTemplate.Models.Count)
                                    {
                                        if (modelObj.TryGetPropertyValue("Architecture", out var archNode))
                                            osTemplate.Models[i].Architecture = archNode?.GetValue<string>() ?? "x86";
                                        if (modelObj.TryGetPropertyValue("Bitness", out var bitsNode))
                                            osTemplate.Models[i].Bitness = bitsNode?.GetValue<string>() ?? "64";
                                    }
                                }
                            }
                            // Parse OS-specific StorageQuota
                            if (osBlock["StorageQuota"] is JsonValue osSq && osSq.TryGetValue<long>(out var osSqVal))
                                osTemplate.StorageQuota = osSqVal;
                            tmpl.OS[kvp.Key] = osTemplate;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[FingerprintConfig] Error parsing OS block '{kvp.Key}': {ex.Message}");
                        throw;
                    }
                }
            }
        }

        Console.WriteLine($"[FingerprintConfig] Loaded {tmpl.OS.Count} OSes: {string.Join(", ", tmpl.OS.Keys)}");
        return tmpl;
    }
}

public class OsTemplate
{
    public List<OsModel> Models { get; set; } = new();
    public List<string> Fonts { get; set; } = new();
    public List<ScreenPreset> ScreenPresets { get; set; } = new();
    public List<HardwareTier> HardwareTiers { get; set; } = new();
    public WebGLTemplate WebGL { get; set; } = new();
    public long StorageQuota { get; set; } = 549755813888;
    public Dictionary<string, List<ConnectionPreset>> ConnectionTypes { get; set; } = new();
}

public class ConnectionPreset
{
    public string EffectiveType { get; set; } = "4g";
    public double Downlink { get; set; } = 10.0;
    public int Rtt { get; set; } = 50;
}

public class OsModel
{
    public string Name { get; set; } = "";
    public string UserAgentTemplate { get; set; } = "";
    public string PlatformString { get; set; } = "";
    public string TLSOSMatch { get; set; } = "";
    public string Architecture { get; set; } = "x86";
    public string Bitness { get; set; } = "64";
}

public class GeoBounds
{
    public double LatMin { get; set; }
    public double LatMax { get; set; }
    public double LngMin { get; set; }
    public double LngMax { get; set; }
}

public class ScreenPreset
{
    public int Width { get; set; }
    public int Height { get; set; }
    public double PixelRatio { get; set; }
}

public class HardwareTier
{
    public int Concurrency { get; set; }
    public int Memory { get; set; }
}

public class WebGLTemplate
{
    // Key = Vendor string, Value = list of Renderer strings
    public Dictionary<string, List<string>> VendorGPUs { get; set; } = new();
}

public class WebGLGpuCandidate
{
    public string Vendor { get; set; } = "";
    public string Renderer { get; set; } = "";
}

public class FingerprintConfig
{
    public WebGLConfig WebGL { get; set; } = new();
    public CanvasConfig Canvas { get; set; } = new();
    public AudioConfig Audio { get; set; } = new();
    public FontMetricsConfig FontMetrics { get; set; } = new();
    public ClientRectsConfig ClientRects { get; set; } = new();
    public List<string> Fonts { get; set; } = new() { "Arial", "Calibri", "Consolas" };
    public List<PluginInfo> Plugins { get; set; } = new()
    {
        new() { Name = "PDF Viewer", Filename = "internal-pdf-viewer", Description = "Portable Document Format" },
        new() { Name = "Chrome PDF Viewer", Filename = "internal-pdf-viewer", Description = "" }
    };
    public MediaDevicesConfig MediaDevices { get; set; } = new();
    public ConnectionConfig Connection { get; set; } = new();
    public long StorageQuota { get; set; } = 549755813888;
    public string TLSOSMatch { get; set; } = "Windows";
    public string? DoNotTrack { get; set; }

    public static FingerprintConfig Default => new();
}

public class PluginInfo
{
    public string Name { get; set; } = "";
    public string Filename { get; set; } = "";
    public string Description { get; set; } = "";
}

public class WebGLConfig
{
    public string Mode { get; set; } = "Noise";
    public string Vendor { get; set; } = "Google Inc. (NVIDIA)";
    public string Renderer { get; set; } = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)";
    public string NoiseSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public double NoiseLevel { get; set; } = 0.0001;
    public ImageSpoofingConfig? ImageSpoofing { get; set; }
}

public class ImageSpoofingConfig
{
    public string TextureSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string Pattern { get; set; } = "default";
}

public class CanvasConfig
{
    public string Mode { get; set; } = "Noise";
    public string NoiseSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public double NoiseLevel { get; set; } = 0.00008;
}

public class AudioConfig
{
    public string Mode { get; set; } = "Noise";
    public string NoiseSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public double NoiseLevel { get; set; } = 0.000001;
}

public class FontMetricsConfig
{
    public string Mode { get; set; } = "Noise";
    public string NoiseSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public double NoiseLevel { get; set; } = 0.0001;
}

public class ClientRectsConfig
{
    public string Mode { get; set; } = "Noise";
    public string NoiseSeed { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public double NoiseLevel { get; set; } = 0.000025;
}

public class MediaDevicesConfig
{
    public string Mode { get; set; } = "Noise";
    public int VideoInputs { get; set; } = 1;
    public int AudioInputs { get; set; } = 1;
    public int AudioOutputs { get; set; } = 1;
}

public class ConnectionConfig
{
    public string Mode { get; set; } = "Noise";
    public string EffectiveType { get; set; } = "4g";
    public double Downlink { get; set; } = 10.0;
    public int Rtt { get; set; } = 50;
    public bool SaveData { get; set; } = false;
}
