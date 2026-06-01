namespace DuckGo.Models.Configs;

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
