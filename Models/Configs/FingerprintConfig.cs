using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;

// ─── Template models (read from default_fingerprint.json at runtime) ────────────

public class FingerprintTemplate
{
    public Dictionary<string, OsTemplate> OS { get; set; } = new();
    public List<string> Timezones { get; set; } = new();
    public List<string> Languages { get; set; } = new();
    public Dictionary<string, GeoBounds> TimezoneGeo { get; set; } = new();
    public Dictionary<string, List<ConnectionPreset>> ConnectionTypes { get; set; } = new();
    public long StorageQuota { get; set; } = 549755813888; // 512 GB

    public static FingerprintTemplate FromJson(string json)
    {
        var node = JsonNode.Parse(json);
        var tmpl = new FingerprintTemplate();
        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        if (node?["Languages"] is JsonArray langArr)
            tmpl.Languages = langArr.Select(x => x!.GetValue<string>()).ToList();

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

        tmpl.Timezones = tmpl.TimezoneGeo.Keys.OrderBy(k => k).ToList();

        if (node is JsonObject obj)
        {
            foreach (var kvp in obj)
            {
                if (kvp.Value is JsonArray || kvp.Key is "Timezones" or "Languages" or "TimezoneGeo")
                    continue;

                if (kvp.Value is JsonObject osBlock)
                {
                    try
                    {
                        var osJson = JsonSerializer.Serialize(osBlock);
                        var osTemplate = JsonSerializer.Deserialize<OsTemplate>(osJson, opts);

                        if (osTemplate != null && osBlock.TryGetPropertyValue("ConnectionTypes", out var osConnTypes) && osConnTypes is JsonObject connObj)
                        {
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

                        if (osTemplate != null && osBlock["Models"] is JsonArray modelsArr)
                        {
                            for (int i = 0; i < modelsArr.Count && i < osTemplate.Models.Count; i++)
                            {
                                if (modelsArr[i] is JsonObject modelObj)
                                {
                                    if (modelObj.TryGetPropertyValue("Architecture", out var archNode))
                                        osTemplate.Models[i].Architecture = archNode?.GetValue<string>() ?? "x86";
                                    if (modelObj.TryGetPropertyValue("Bitness", out var bitsNode))
                                        osTemplate.Models[i].Bitness = bitsNode?.GetValue<string>() ?? "64";
                                }
                            }
                        }

                        if (osTemplate != null && osBlock["StorageQuota"] is JsonValue osSq && osSq.TryGetValue<long>(out var osSqVal))
                            osTemplate.StorageQuota = osSqVal;

                        // Parse WebGL extensions and max texture size
                        if (osTemplate != null && osBlock["WebGL"] is JsonObject webglBlock)
                        {
                            if (webglBlock["MaxTextureSize"] is JsonValue maxTexVal && maxTexVal.TryGetValue<int>(out var maxTex))
                                osTemplate.WebGL.MaxTextureSize = maxTex;
                            
                            if (webglBlock["Extensions"] is JsonArray extArr)
                                osTemplate.WebGL.Extensions = extArr.Select(x => x!.GetValue<string>()).ToList();
                        }

                        tmpl.OS[kvp.Key] = osTemplate!;
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
    public Dictionary<string, List<string>> VendorGPUs { get; set; } = new();
    /// <summary>List of WebGL extensions. Must match GPU capability.</summary>
    public List<string> Extensions { get; set; } = new();
    /// <summary>Max texture size supported by GPU.</summary>
    public int MaxTextureSize { get; set; } = 16384;
}

// ─── Fingerprint Config (ProfileData stored in DB) ───────────────────────────

public class FingerprintConfig
{
    /// <summary>WebGL fingerprinting — GPU Vendor, Renderer, canvas readPixels noise.</summary>
    public WebGLConfig WebGL { get; set; } = new();
    /// <summary>Canvas 2D API fingerprinting — toDataURL/getImageData noise.</summary>
    public CanvasConfig Canvas { get; set; } = new();
    /// <summary>AudioContext fingerprinting — AudioWorklet/AnalyserNode noise.</summary>
    public AudioConfig Audio { get; set; } = new();
    /// <summary>Font metrics fingerprinting — measureText/getBoundingClientRect noise.</summary>
    public FontMetricsConfig FontMetrics { get; set; } = new();
    /// <summary>DOM element getBoundingClientRect noise.</summary>
    public ClientRectsConfig ClientRects { get; set; } = new();

    /// <summary>Font enumeration — returns fake font list via SkFontMgr hook.</summary>
    public FontsConfig Fonts { get; set; } = new();
    /// <summary>Browser plugin enumeration — returns fake plugin list.</summary>
    public PluginsConfig Plugins { get; set; } = new();
    /// <summary>WebRTC fingerprinting behavior.</summary>
    public string WebRTcMode { get; set; } = "disable";
    /// <summary>SSL/TLS fingerprinting — JA3 cipher suites.</summary>
    public string SslMode { get; set; } = "noise";
    /// <summary>Speech Synthesis API — voice enumeration.</summary>
    public string SpeechVoicesMode { get; set; } = "noise";
    /// <summary>MediaDevices — webcam/microphone/speaker enumeration.</summary>
    public MediaDevicesConfig MediaDevices { get; set; } = new();
    /// <summary>Network Information API — effectiveType, downlink, rtt.</summary>
    public ConnectionConfig Connection { get; set; } = new();
    /// <summary>navigator.storage.estimate() — fake disk quota.</summary>
    public TypedConfig<long?> StorageQuota { get; set; } = new();
    /// <summary>TLS OS fingerprint — controls JA3 cipher suite ordering.</summary>
    public TypedConfig<string> TLSOSMatch { get; set; } = new();
    /// <summary>DoNotTrack HTTP header.</summary>
    public DoNotTrackConfig DoNotTrack { get; set; } = new();

    public static FingerprintConfig Default => new();
}

// ─── Typed configs ────────────────────────────────────────────────────────────

/// <summary>
/// Generic config with mode + typed value.
/// Used for: StorageQuota, TLSOSMatch.
/// </summary>
/// <typeparam name="T">Value type: string, int, long, bool</typeparam>
public class TypedConfig<T>
{
    /// <summary>
    /// Mode: "noise" (use Value), "real" (use real device), "default" (use Chromium default).
    /// null is treated as "real" by DuckBrowser.
    /// </summary>
    public string? Mode { get; set; }
    public T? Value { get; set; }

    public TypedConfig() { }
    public TypedConfig(string? mode, T? value) { Mode = mode; Value = value; }
    /// <summary>Constructor with mode only — Value defaults to null.</summary>
    public TypedConfig(string? mode) { Mode = mode; Value = default; }
}

public class DoNotTrackConfig
{
    /// <summary>
    /// Mode: "real" (don't set header), "noise" (set header with Value).
    /// null is treated as "real".
    /// </summary>
    public string? Mode { get; set; }
    /// <summary>Value: "1" (enabled), "0" (disabled), null (don't set header).</summary>
    public string? Value { get; set; }
}

// ─── WebGL ────────────────────────────────────────────────────────────────────

public class WebGLConfig
{
    /// <summary>WebGL mode: "noise" (fake + noise), "real" (real GPU), "default" (Chromium), "block" (return null).</summary>
    public string? Mode { get; set; }
    public string? Vendor { get; set; }
    public string? Renderer { get; set; }
    public string? NoiseSeed { get; set; }
    public double? NoiseLevel { get; set; }
    /// <summary>List of WebGL extensions supported. Must match GPU capability.</summary>
    public List<string> Extensions { get; set; } = new();
    /// <summary>Max texture size supported by GPU.</summary>
    public int? MaxTextureSize { get; set; }
    public ImageSpoofingConfig? ImageSpoofing { get; set; }
}

public class ImageSpoofingConfig
{
    /// <summary>Image spoofing mode: "noise" (texture noise), "real", "default", "block". null = "noise".</summary>
    public string? Mode { get; set; }
    public string? TextureSeed { get; set; }
    /// <summary>Pattern: "default" (gradient), "noise" (random pixels), "solid".</summary>
    public string Pattern { get; set; } = "default";
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

public class CanvasConfig
{
    /// <summary>Canvas mode: "noise" (fake + noise), "real", "default", "block". null = "real".</summary>
    public string? Mode { get; set; }
    public string? NoiseSeed { get; set; }
    public double? NoiseLevel { get; set; }
}

// ─── Audio ────────────────────────────────────────────────────────────────────

public class AudioConfig
{
    /// <summary>Audio mode: "noise" (fake + noise), "real", "default", "block". null = "real".</summary>
    public string? Mode { get; set; }
    public string? NoiseSeed { get; set; }
    public double? NoiseLevel { get; set; }
    /// <summary>AudioContext sample rate. Default 48000.</summary>
    public int? SampleRate { get; set; }
}

// ─── FontMetrics ──────────────────────────────────────────────────────────────

public class FontMetricsConfig
{
    /// <summary>FontMetrics mode: "noise" (fake + noise), "real" (use real metrics), "default". null = "real".</summary>
    public string? Mode { get; set; }
    public string? NoiseSeed { get; set; }
    public double? NoiseLevel { get; set; }
}

// ─── ClientRects ─────────────────────────────────────────────────────────────

public class ClientRectsConfig
{
    /// <summary>ClientRects mode: "noise" (fake + noise), "real", "default", "block". null = "real".</summary>
    public string? Mode { get; set; }
    public string? NoiseSeed { get; set; }
    public double? NoiseLevel { get; set; }
}

// ─── Fonts ────────────────────────────────────────────────────────────────────

public class FontsConfig
{
    /// <summary>Fonts mode: "noise" (use FontList), "real" (real fonts), "default" (Chromium list), "block" (empty). null = "real".</summary>
    public string? Mode { get; set; }
    /// <summary>List of fake font names to return via SkFontMgr hook.</summary>
    public List<string> FontList { get; set; } = new();
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

public class PluginsConfig
{
    /// <summary>Plugins mode: "noise", "real", "default", "block". null = "default".</summary>
    public string? Mode { get; set; }
    public List<PluginInfo> PluginList { get; set; } = new();
}

public class PluginInfo
{
    public string Name { get; set; } = "";
    public string Filename { get; set; } = "";
    public string Description { get; set; } = "";
}

// ─── MediaDevices ────────────────────────────────────────────────────────────

public class MediaDevicesConfig
{
    /// <summary>MediaDevices mode: "noise" (use counts below), "real" (real devices), "default", "block". null = "real".</summary>
    public string? Mode { get; set; }
    public int? VideoInputs { get; set; }
    public int? AudioInputs { get; set; }
    public int? AudioOutputs { get; set; }
}

// ─── Connection ───────────────────────────────────────────────────────────────

public class ConnectionConfig
{
    /// <summary>Connection mode: "noise" (use values below), "real", "default". null = "default".</summary>
    public string? Mode { get; set; }
    public string EffectiveType { get; set; } = "4g";
    public double Downlink { get; set; } = 10.0;
    public int Rtt { get; set; } = 50;
    public bool SaveData { get; set; } = false;
}
