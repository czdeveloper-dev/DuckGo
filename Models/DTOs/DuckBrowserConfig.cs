using System.Text.Json.Serialization;

namespace DuckGo.Models.DTOs;

/// <summary>
/// Full config sent to DuckBrowser via Named Pipe
/// Follows duckbrowser_project_plan.md PHẦN 3 JSON CONFIG SCHEMA
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

    [JsonPropertyName("UI")]
    public DuckUiConfig? UI { get; set; }

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
    [JsonPropertyName("BrowserVersion")]
    public string BrowserVersion { get; set; } = "138";

    [JsonPropertyName("Platform")]
    public string Platform { get; set; } = "Win32";

    [JsonPropertyName("Language")]
    public string Language { get; set; } = "en-US";

    [JsonPropertyName("Languages")]
    public List<string>? Languages { get; set; }

    [JsonPropertyName("UserAgent")]
    public string UserAgent { get; set; } = "";

    [JsonPropertyName("AcceptLanguage")]
    public string AcceptLanguage { get; set; } = "en-US,en;q=0.9";

    [JsonPropertyName("Timezone")]
    public string Timezone { get; set; } = "UTC";

    [JsonPropertyName("TimezoneOffset")]
    public int? TimezoneOffset { get; set; }

    [JsonPropertyName("HardwareConcurrency")]
    public int HardwareConcurrency { get; set; } = 8;

    [JsonPropertyName("DeviceMemory")]
    public int DeviceMemory { get; set; } = 8;

    [JsonPropertyName("Architecture")]
    public string Architecture { get; set; } = "x86";

    [JsonPropertyName("Bitness")]
    public string Bitness { get; set; } = "64";

    [JsonPropertyName("CpuBrand")]
    public string? CpuBrand { get; set; }

    [JsonPropertyName("Touch")]
    public DuckTouchConfig? Touch { get; set; }

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

    [JsonPropertyName("AvailWidth")]
    public int? AvailWidth { get; set; }

    [JsonPropertyName("AvailHeight")]
    public int? AvailHeight { get; set; }

    [JsonPropertyName("AvailLeft")]
    public int? AvailLeft { get; set; }

    [JsonPropertyName("AvailTop")]
    public int? AvailTop { get; set; }

    [JsonPropertyName("OuterWidth")]
    public int? OuterWidth { get; set; }

    [JsonPropertyName("OuterHeight")]
    public int? OuterHeight { get; set; }
}

public class DuckTouchConfig
{
    [JsonPropertyName("MaxTouchPoints")]
    public int? MaxTouchPoints { get; set; }

    [JsonPropertyName("TouchSupport")]
    public bool? TouchSupport { get; set; }
}

public class DuckFingerprintConfig
{
    [JsonPropertyName("WebGL")]
    public DuckWebGLConfig? WebGL { get; set; }

    [JsonPropertyName("WebGL2")]
    public DuckWebGL2Config? WebGL2 { get; set; }

    [JsonPropertyName("Canvas")]
    public DuckCanvasConfig? Canvas { get; set; }

    [JsonPropertyName("Audio")]
    public DuckAudioConfig? Audio { get; set; }

    [JsonPropertyName("FontMetrics")]
    public DuckFontMetricsConfig? FontMetrics { get; set; }

    [JsonPropertyName("ClientRects")]
    public DuckClientRectsConfig? ClientRects { get; set; }

    [JsonPropertyName("Fonts")]
    public DuckFontsConfig? Fonts { get; set; }

    [JsonPropertyName("Navigator")]
    public DuckNavigatorConfig? Navigator { get; set; }

    [JsonPropertyName("Plugins")]
    public List<DuckPluginConfig>? Plugins { get; set; }

    [JsonPropertyName("Connection")]
    public DuckConnectionConfig? Connection { get; set; }

    [JsonPropertyName("MediaDevices")]
    public DuckMediaDevicesConfig? MediaDevices { get; set; }

    [JsonPropertyName("TLS")]
    public DuckTlsConfig? TLS { get; set; }

    [JsonPropertyName("Speech")]
    public DuckSpeechConfig? Speech { get; set; }

    [JsonPropertyName("WebRtc")]
    public DuckWebRtcConfig? WebRtc { get; set; }

    [JsonPropertyName("Dns")]
    public DuckDnsConfig? Dns { get; set; }

    [JsonPropertyName("Security")]
    public DuckFingerprintSecurityConfig? Security { get; set; }

    [JsonPropertyName("StorageQuota")]
    public long? StorageQuota { get; set; }

    [JsonPropertyName("Storage")]
    public DuckStorageConfig? Storage { get; set; }

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

    [JsonPropertyName("Extensions")]
    public List<string>? Extensions { get; set; }

    [JsonPropertyName("MaxTextureSize")]
    public int? MaxTextureSize { get; set; }

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

public class DuckWebGL2Config
{
    [JsonPropertyName("Alpha")]
    public bool? Alpha { get; set; }

    [JsonPropertyName("Depth")]
    public bool? Depth { get; set; }

    [JsonPropertyName("Stencil")]
    public bool? Stencil { get; set; }

    [JsonPropertyName("Antialias")]
    public bool? Antialias { get; set; }

    [JsonPropertyName("PremultipliedAlpha")]
    public bool? PremultipliedAlpha { get; set; }

    [JsonPropertyName("PreserveDrawingBuffer")]
    public bool? PreserveDrawingBuffer { get; set; }

    [JsonPropertyName("FailIfMajorPerformanceCaveat")]
    public bool? FailIfMajorPerformanceCaveat { get; set; }

    [JsonPropertyName("XRCompatible")]
    public bool? XRCompatible { get; set; }

    [JsonPropertyName("PowerPreference")]
    public string? PowerPreference { get; set; }

    [JsonPropertyName("ShaderSource")]
    public DuckShaderSourceConfig? ShaderSource { get; set; }

    [JsonPropertyName("DrawingBufferWidth")]
    public int? DrawingBufferWidth { get; set; }

    [JsonPropertyName("DrawingBufferHeight")]
    public int? DrawingBufferHeight { get; set; }
}

public class DuckShaderSourceConfig
{
    [JsonPropertyName("StripDebugMarkers")]
    public bool? StripDebugMarkers { get; set; }

    [JsonPropertyName("DebugMarkers")]
    public List<string>? DebugMarkers { get; set; }
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

    [JsonPropertyName("SampleRate")]
    public int? SampleRate { get; set; }
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

public class DuckFontsConfig
{
    [JsonPropertyName("Family")]
    public List<string>? Family { get; set; }

    [JsonPropertyName("Emoji")]
    public List<string>? Emoji { get; set; }
}

public class DuckNavigatorConfig
{
    [JsonPropertyName("HardwareConcurrency")]
    public int? HardwareConcurrency { get; set; }

    [JsonPropertyName("DeviceMemory")]
    public int? DeviceMemory { get; set; }

    [JsonPropertyName("Platform")]
    public string? Platform { get; set; }

    [JsonPropertyName("Language")]
    public string? Language { get; set; }

    [JsonPropertyName("Languages")]
    public List<string>? Languages { get; set; }

    [JsonPropertyName("Vendor")]
    public string? Vendor { get; set; }

    [JsonPropertyName("AppCodeName")]
    public string? AppCodeName { get; set; }

    [JsonPropertyName("AppName")]
    public string? AppName { get; set; }

    [JsonPropertyName("Product")]
    public string? Product { get; set; }

    [JsonPropertyName("ProductSub")]
    public string? ProductSub { get; set; }

    [JsonPropertyName("DoNotTrack")]
    public string? DoNotTrack { get; set; }

    [JsonPropertyName("CookieEnabled")]
    public bool? CookieEnabled { get; set; }

    [JsonPropertyName("TLSOSMatch")]
    public string? TLSOSMatch { get; set; }

    [JsonPropertyName("VisualViewportScale")]
    public double? VisualViewportScale { get; set; }

    [JsonPropertyName("VisualViewportOffsetLeft")]
    public double? VisualViewportOffsetLeft { get; set; }

    [JsonPropertyName("VisualViewportOffsetTop")]
    public double? VisualViewportOffsetTop { get; set; }

    [JsonPropertyName("VisualViewportPageLeft")]
    public double? VisualViewportPageLeft { get; set; }

    [JsonPropertyName("VisualViewportPageTop")]
    public double? VisualViewportPageTop { get; set; }
}

public class DuckTlsConfig
{
    [JsonPropertyName("Os")]
    public string? Os { get; set; }

    [JsonPropertyName("CipherList")]
    public List<string>? CipherList { get; set; }

    [JsonPropertyName("CurvesList")]
    public List<string>? CurvesList { get; set; }
}

public class DuckWebRtcConfig
{
    [JsonPropertyName("Policy")]
    public string? Policy { get; set; }

    [JsonPropertyName("BlockNonProxiedUdp")]
    public bool? BlockNonProxiedUdp { get; set; }
}

public class DuckDnsConfig
{
    [JsonPropertyName("Policy")]
    public string? Policy { get; set; }
}

public class DuckSpeechConfig
{
    [JsonPropertyName("Seed")]
    public int? Seed { get; set; }

    [JsonPropertyName("Voices")]
    public List<DuckSpeechVoiceConfig>? Voices { get; set; }
}

public class DuckSpeechVoiceConfig
{
    [JsonPropertyName("Name")]
    public string? Name { get; set; }

    [JsonPropertyName("Lang")]
    public string? Lang { get; set; }

    [JsonPropertyName("LocalService")]
    public bool? LocalService { get; set; }

    [JsonPropertyName("Default")]
    public bool? Default { get; set; }

    [JsonPropertyName("VoiceURI")]
    public string? VoiceURI { get; set; }
}

public class DuckFingerprintSecurityConfig
{
    [JsonPropertyName("PortBlockMode")]
    public string? PortBlockMode { get; set; }

    [JsonPropertyName("PortBlockList")]
    public List<string>? PortBlockList { get; set; }

    [JsonPropertyName("Process")]
    public DuckSecurityProcessConfig? Process { get; set; }

    [JsonPropertyName("Window")]
    public DuckSecurityWindowConfig? Window { get; set; }

    [JsonPropertyName("DevTools")]
    public DuckSecurityDevToolsConfig? DevTools { get; set; }

    [JsonPropertyName("Console")]
    public DuckSecurityConsoleConfig? Console { get; set; }

    [JsonPropertyName("NodeGlobals")]
    public DuckSecurityNodeGlobalsConfig? NodeGlobals { get; set; }

    [JsonPropertyName("ProtoGuard")]
    public DuckSecurityProtoGuardConfig? ProtoGuard { get; set; }

    [JsonPropertyName("CssAnimation")]
    public DuckSecurityCssAnimationConfig? CssAnimation { get; set; }

    [JsonPropertyName("ChromeInternal")]
    public DuckSecurityChromeInternalConfig? ChromeInternal { get; set; }

    [JsonPropertyName("FeatureDetection")]
    public DuckSecurityFeatureDetectionConfig? FeatureDetection { get; set; }

    [JsonPropertyName("Script")]
    public DuckSecurityScriptConfig? Script { get; set; }

    [JsonPropertyName("Device")]
    public DuckSecurityDeviceConfig? Device { get; set; }

    [JsonPropertyName("Notification")]
    public DuckSecurityNotificationConfig? Notification { get; set; }

    [JsonPropertyName("BlobUrl")]
    public DuckSecurityBlobUrlConfig? BlobUrl { get; set; }
}

public class DuckSecurityProcessConfig { [JsonPropertyName("Type")] public string? Type { get; set; } }
public class DuckSecurityWindowConfig { [JsonPropertyName("ChromeOffsetPx")] public int? ChromeOffsetPx { get; set; } }
public class DuckSecurityDevToolsConfig { [JsonPropertyName("HideApi")] public bool? HideApi { get; set; } [JsonPropertyName("InjectProxy")] public bool? InjectProxy { get; set; } }
public class DuckSecurityConsoleConfig { [JsonPropertyName("HardenProto")] public bool? HardenProto { get; set; } }
public class DuckSecurityNodeGlobalsConfig { [JsonPropertyName("Mode")] public string? Mode { get; set; } }
public class DuckSecurityProtoGuardConfig { [JsonPropertyName("ChainToObject")] public List<string>? ChainToObject { get; set; } [JsonPropertyName("RestoreFunctions")] public List<string>? RestoreFunctions { get; set; } }
public class DuckSecurityCssAnimationConfig { [JsonPropertyName("AnimationPrefixes")] public List<string>? AnimationPrefixes { get; set; } [JsonPropertyName("KeyframesPrefixes")] public List<string>? KeyframesPrefixes { get; set; } [JsonPropertyName("TransitionPrefixes")] public List<string>? TransitionPrefixes { get; set; } [JsonPropertyName("KeyframeNames")] public List<string>? KeyframeNames { get; set; } }
public class DuckSecurityChromeInternalConfig { [JsonPropertyName("FakeCsiData")] public bool? FakeCsiData { get; set; } [JsonPropertyName("FakeLoadTimes")] public bool? FakeLoadTimes { get; set; } [JsonPropertyName("EmptyCommands")] public bool? EmptyCommands { get; set; } [JsonPropertyName("ExtraLeakNames")] public List<string>? ExtraLeakNames { get; set; } }
public class DuckSecurityFeatureDetectionConfig { [JsonPropertyName("IntersectionObserver")] public bool? IntersectionObserver { get; set; } [JsonPropertyName("HeadlessCssQueries")] public List<string>? HeadlessCssQueries { get; set; } [JsonPropertyName("CssSupports")] public DuckSecurityCssSupportsConfig? CssSupports { get; set; } }
public class DuckSecurityCssSupportsConfig { [JsonPropertyName("Mode")] public string? Mode { get; set; } [JsonPropertyName("Entries")] public List<string>? Entries { get; set; } }
public class DuckSecurityScriptConfig { [JsonPropertyName("FunctionToString")] public string? FunctionToString { get; set; } [JsonPropertyName("ProtectedNativeFunctionNames")] public List<string>? ProtectedNativeFunctionNames { get; set; } [JsonPropertyName("StackScrubMode")] public string? StackScrubMode { get; set; } [JsonPropertyName("FrameworkPathMarkers")] public List<string>? FrameworkPathMarkers { get; set; } [JsonPropertyName("EvalInvariants")] public DuckSecurityEvalInvariantsConfig? EvalInvariants { get; set; } [JsonPropertyName("CssSupports")] public DuckSecurityCssSupportsConfig? CssSupports { get; set; } [JsonPropertyName("WasmTimingJitterMs")] public double? WasmTimingJitterMs { get; set; } }
public class DuckSecurityEvalInvariantsConfig { [JsonPropertyName("Names")] public List<string>? Names { get; set; } }
public class DuckSecurityDeviceConfig { [JsonPropertyName("MockFullscreenAPI")] public bool? MockFullscreenAPI { get; set; } [JsonPropertyName("MockCredentialManagement")] public bool? MockCredentialManagement { get; set; } [JsonPropertyName("MockScreenOrientation")] public bool? MockScreenOrientation { get; set; } [JsonPropertyName("MockPictureInPicture")] public bool? MockPictureInPicture { get; set; } [JsonPropertyName("MockPointerLock")] public bool? MockPointerLock { get; set; } [JsonPropertyName("MockWakeLock")] public bool? MockWakeLock { get; set; } [JsonPropertyName("HideDeviceAPIs")] public bool? HideDeviceAPIs { get; set; } }
public class DuckSecurityNotificationConfig { [JsonPropertyName("PermissionPolicy")] public string? PermissionPolicy { get; set; } }
public class DuckSecurityBlobUrlConfig { [JsonPropertyName("Format")] public string? Format { get; set; } }

public class DuckStorageConfig
{
    [JsonPropertyName("Persisted")]
    public bool? Persisted { get; set; }
}

public class DuckUiConfig
{
    [JsonPropertyName("Mode")]
    public string? Mode { get; set; }

    [JsonPropertyName("Headless")]
    public DuckHeadlessConfig? Headless { get; set; }

    [JsonPropertyName("WindowSize")]
    public DuckWindowSizeConfig? WindowSize { get; set; }
}

public class DuckHeadlessConfig
{
    [JsonPropertyName("TimingJitterMs")]
    public double? TimingJitterMs { get; set; }

    [JsonPropertyName("ChromeOffsetExtraPx")]
    public int? ChromeOffsetExtraPx { get; set; }

    [JsonPropertyName("PermissionPolicy")]
    public string? PermissionPolicy { get; set; }
}

public class DuckWindowSizeConfig
{
    [JsonPropertyName("Width")]
    public int? Width { get; set; }

    [JsonPropertyName("Height")]
    public int? Height { get; set; }
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
