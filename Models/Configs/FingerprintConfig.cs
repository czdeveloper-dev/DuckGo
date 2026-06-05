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

        if (node?["Timezones"] is JsonArray tzArr)
            tmpl.Timezones = tzArr.Select(x => x!.GetValue<string>()).ToList();

        if (node?["Languages"] is JsonArray langArr)
            tmpl.Languages = langArr.Select(x => x!.GetValue<string>()).ToList();

        if (node is JsonObject obj)
        {
            foreach (var kvp in obj)
            {
                // Skip arrays we already handled
                if (kvp.Value is JsonArray || kvp.Key is "Timezones" or "Languages")
                    continue;
                // Everything else is treated as an OS block (Windows, macOS, Linux...)
                if (kvp.Value is JsonObject osBlock)
                {
                    var osJson = JsonSerializer.Serialize(osBlock);
                    var osTemplate = JsonSerializer.Deserialize<OsTemplate>(osJson, opts);
                    if (osTemplate != null)
                        tmpl.OS[kvp.Key] = osTemplate;
                }
            }
        }

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
}

public class OsModel
{
    public string Name { get; set; } = "";
    public string UserAgentTemplate { get; set; } = "";
    public string PlatformString { get; set; } = "";
    public string TLSOSMatch { get; set; } = "";
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
