using System.Text.Json.Serialization;

namespace DuckGo.Models.DTOs;

/// <summary>
/// Full config sent to DuckBrowser via Named Pipe
/// </summary>
public class DuckBrowserConfig
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "CONFIG";

    [JsonPropertyName("Profile")]
    public DuckProfileConfig? Profile { get; set; }

    [JsonPropertyName("System")]
    public DuckSystemConfig? System { get; set; }

    [JsonPropertyName("Fingerprint")]
    public DuckFingerprintConfig? Fingerprint { get; set; }

    [JsonPropertyName("Network")]
    public DuckNetworkConfig? Network { get; set; }

    [JsonPropertyName("Location")]
    public DuckLocationConfig? Location { get; set; }

    [JsonPropertyName("Security")]
    public DuckSecurityConfig? Security { get; set; }

    [JsonPropertyName("FileSystem")]
    public DuckFileSystemConfig? FileSystem { get; set; }

    [JsonPropertyName("ResourceLimits")]
    public DuckResourceLimitsConfig? ResourceLimits { get; set; }
}

public class DuckProfileConfig
{
    [JsonPropertyName("ProfileID")]
    public string ProfileID { get; set; } = "";

    [JsonPropertyName("ProfileName")]
    public string ProfileName { get; set; } = "";

    [JsonPropertyName("StartURL")]
    public string? StartURL { get; set; }
}

public class DuckSystemConfig
{
    [JsonPropertyName("Platform")]
    public string Platform { get; set; } = "Win32";

    [JsonPropertyName("Language")]
    public string Language { get; set; } = "en-US";

    [JsonPropertyName("UserAgent")]
    public string UserAgent { get; set; } = "";

    [JsonPropertyName("AcceptLanguage")]
    public string AcceptLanguage { get; set; } = "en-US,en;q=0.9";

    [JsonPropertyName("Timezone")]
    public string Timezone { get; set; } = "UTC";

    [JsonPropertyName("HardwareConcurrency")]
    public int HardwareConcurrency { get; set; } = 8;

    [JsonPropertyName("DeviceMemory")]
    public int DeviceMemory { get; set; } = 8;

    [JsonPropertyName("Architecture")]
    public string Architecture { get; set; } = "x86";

    [JsonPropertyName("Bitness")]
    public string Bitness { get; set; } = "64";

    [JsonPropertyName("Screen")]
    public DuckScreenConfig? Screen { get; set; }
}

public class DuckScreenConfig
{
    [JsonPropertyName("Width")]
    public int Width { get; set; } = 1920;

    [JsonPropertyName("Height")]
    public int Height { get; set; } = 1080;

    [JsonPropertyName("ColorDepth")]
    public int ColorDepth { get; set; } = 24;

    [JsonPropertyName("PixelRatio")]
    public double PixelRatio { get; set; } = 1.0;
}

public class DuckFingerprintConfig
{
    [JsonPropertyName("WebGL")]
    public DuckWebGLConfig? WebGL { get; set; }

    [JsonPropertyName("Canvas")]
    public DuckCanvasConfig? Canvas { get; set; }

    [JsonPropertyName("Audio")]
    public DuckAudioConfig? Audio { get; set; }

    [JsonPropertyName("FontMetrics")]
    public DuckFontMetricsConfig? FontMetrics { get; set; }

    [JsonPropertyName("ClientRects")]
    public DuckClientRectsConfig? ClientRects { get; set; }

    [JsonPropertyName("Fonts")]
    public List<string>? Fonts { get; set; }

    [JsonPropertyName("Plugins")]
    public List<DuckPluginConfig>? Plugins { get; set; }

    [JsonPropertyName("Connection")]
    public DuckConnectionConfig? Connection { get; set; }

    [JsonPropertyName("MediaDevices")]
    public DuckMediaDevicesConfig? MediaDevices { get; set; }

    [JsonPropertyName("StorageQuota")]
    public long? StorageQuota { get; set; }

    [JsonPropertyName("TLSOSMatch")]
    public string? TLSOSMatch { get; set; }

    [JsonPropertyName("DoNotTrack")]
    public string? DoNotTrack { get; set; }
}

public class DuckWebGLConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("Vendor")]
    public string? Vendor { get; set; }

    [JsonPropertyName("Renderer")]
    public string? Renderer { get; set; }

    [JsonPropertyName("NoiseSeed")]
    public string? NoiseSeed { get; set; }

    [JsonPropertyName("NoiseLevel")]
    public double? NoiseLevel { get; set; }

    [JsonPropertyName("ImageSpoofing")]
    public DuckWebGLImageSpoofing? ImageSpoofing { get; set; }
}

public class DuckWebGLImageSpoofing
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("TextureSeed")]
    public string? TextureSeed { get; set; }

    [JsonPropertyName("Pattern")]
    public string Pattern { get; set; } = "default";
}

public class DuckCanvasConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("NoiseSeed")]
    public string? NoiseSeed { get; set; }

    [JsonPropertyName("NoiseLevel")]
    public double? NoiseLevel { get; set; }
}

public class DuckAudioConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("NoiseSeed")]
    public string? NoiseSeed { get; set; }

    [JsonPropertyName("NoiseLevel")]
    public double? NoiseLevel { get; set; }
}

public class DuckFontMetricsConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("NoiseSeed")]
    public string? NoiseSeed { get; set; }

    [JsonPropertyName("NoiseLevel")]
    public double? NoiseLevel { get; set; }
}

public class DuckClientRectsConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("NoiseSeed")]
    public string? NoiseSeed { get; set; }

    [JsonPropertyName("NoiseLevel")]
    public double? NoiseLevel { get; set; }
}

public class DuckPluginConfig
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("filename")]
    public string Filename { get; set; } = "";

    [JsonPropertyName("description")]
    public string Description { get; set; } = "";
}

public class DuckConnectionConfig
{
    [JsonPropertyName("Mode")]
    public string Mode { get; set; } = "Noise";

    [JsonPropertyName("EffectiveType")]
    public string EffectiveType { get; set; } = "4g";

    [JsonPropertyName("Downlink")]
    public double Downlink { get; set; } = 10.0;

    [JsonPropertyName("Rtt")]
    public int Rtt { get; set; } = 50;

    [JsonPropertyName("SaveData")]
    public bool SaveData { get; set; } = false;
}

public class DuckMediaDevicesConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("VideoInputs")]
    public int? VideoInputs { get; set; }

    [JsonPropertyName("AudioInputs")]
    public int? AudioInputs { get; set; }

    [JsonPropertyName("AudioOutputs")]
    public int? AudioOutputs { get; set; }
}

public class DuckNetworkConfig
{
    [JsonPropertyName("Proxy")]
    public DuckProxyConfig? Proxy { get; set; }
}

public class DuckProxyConfig
{
    [JsonPropertyName("Type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("Host")]
    public string? Host { get; set; }

    [JsonPropertyName("Port")]
    public int? Port { get; set; }

    [JsonPropertyName("Username")]
    public string? Username { get; set; }

    [JsonPropertyName("Password")]
    public string? Password { get; set; }
}

public class DuckLocationConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("Latitude")]
    public double? Latitude { get; set; }

    [JsonPropertyName("Longitude")]
    public double? Longitude { get; set; }

    [JsonPropertyName("Accuracy")]
    public int? Accuracy { get; set; }
}

public class DuckSecurityConfig
{
    [JsonPropertyName("PortBlockMode")]
    public string PortBlockMode { get; set; } = "block_default";

    [JsonPropertyName("PortBlockList")]
    public List<string>? PortBlockList { get; set; }
}

public class DuckFileSystemConfig
{
    [JsonPropertyName("ProfilePath")]
    public string? ProfilePath { get; set; }

    [JsonPropertyName("DownloadLocation")]
    public string? DownloadLocation { get; set; }
}

public class DuckResourceLimitsConfig
{
    [JsonPropertyName("max_memory_mb")]
    public int MaxMemoryMb { get; set; } = 512;

    [JsonPropertyName("target_memory_mb")]
    public int TargetMemoryMb { get; set; } = 384;

    [JsonPropertyName("max_cpu_percent")]
    public int MaxCpuPercent { get; set; } = 50;

    [JsonPropertyName("thread_limit")]
    public int ThreadLimit { get; set; } = 8;

    [JsonPropertyName("enable_memory_optimization")]
    public bool EnableMemoryOptimization { get; set; } = true;

    [JsonPropertyName("enable_cpu_throttling")]
    public bool EnableCpuThrottling { get; set; } = true;
}
