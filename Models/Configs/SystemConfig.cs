using System.Collections.Generic;

// TypedConfig<T> and DoNotTrackConfig are defined in FingerprintConfig.cs
// Both files share the same namespace DuckGo.Models.Configs

namespace DuckGo.Models.Configs;

public class SystemConfig
{
    /// <summary>Browser version used to generate UserAgent string. e.g. "138".</summary>
    public string BrowserVersion { get; set; } = "138";

    /// <summary>Platform navigator.platform — e.g. "Win32", "MacIntel".</summary>
    public TypedConfig<string> Platform { get; set; } = new();
    /// <summary>navigator.language — e.g. "en-US".</summary>
    public TypedConfig<string> Language { get; set; } = new();
    /// <summary>Full UserAgent string. C++ auto-generates Sec-CH-UA from this.</summary>
    public TypedConfig<string> UserAgent { get; set; } = new();
    /// <summary>Accept-Language HTTP header — e.g. "en-US,en;q=0.9".</summary>
    public TypedConfig<string> AcceptLanguage { get; set; } = new();
    /// <summary>navigator.languages — array of preferred languages.</summary>
    public List<string> Languages { get; set; } = new();
    /// <summary>IANA timezone — e.g. "America/New_York". Hooks Intl.DateTimeFormat in V8.</summary>
    public TypedConfig<string> Timezone { get; set; } = new();
    /// <summary>Timezone offset in minutes from UTC. Backup if IANA fails.</summary>
    public int? TimezoneOffset { get; set; }

    /// <summary>navigator.hardwareConcurrency — logical CPU cores. Must be even number.</summary>
    public TypedConfig<int?> HardwareConcurrency { get; set; } = new();
    /// <summary>navigator.deviceMemory — RAM in GB. Powers of 2.</summary>
    public TypedConfig<int?> DeviceMemory { get; set; } = new();
    /// <summary>Client Hints API chip architecture.</summary>
    public TypedConfig<string> Architecture { get; set; } = new();
    /// <summary>OS bitness.</summary>
    public TypedConfig<string> Bitness { get; set; } = new();
    /// <summary>CPU brand string for Client Hints.</summary>
    public TypedConfig<string> CpuBrand { get; set; } = new();

    /// <summary>Touch configuration.</summary>
    public TouchConfig Touch { get; set; } = new();
    /// <summary>Screen configuration.</summary>
    public ScreenConfig Screen { get; set; } = new();

    public static SystemConfig Default => new();
}

public class TouchConfig
{
    /// <summary>Touch mode: "real", "default", "noise". null = "default".</summary>
    public string? Mode { get; set; }
    /// <summary>navigator.maxTouchPoints — number of touch points. Desktop = 0.</summary>
    public int? MaxTouchPoints { get; set; }
    /// <summary>navigator.maxTouchPoints > 0 check.</summary>
    public bool? TouchSupport { get; set; }
}

public class ScreenConfig
{
    /// <summary>
    /// Screen mode: "real" (use real screen), "default" (Chromium default), "noise" (use values below).
    /// null is treated as "real".
    /// </summary>
    public string? Mode { get; set; }
    public int? Width { get; set; }
    public int? Height { get; set; }
    public int? ColorDepth { get; set; }
    public double? PixelRatio { get; set; }
    /// <summary>Available screen width (minus taskbar).</summary>
    public int? AvailWidth { get; set; }
    /// <summary>Available screen height (minus taskbar).</summary>
    public int? AvailHeight { get; set; }
    /// <summary>Available screen left position.</summary>
    public int? AvailLeft { get; set; }
    /// <summary>Available screen top position.</summary>
    public int? AvailTop { get; set; }
}
