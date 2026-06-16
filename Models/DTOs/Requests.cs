using DuckGo.Models.Configs;

namespace DuckGo.Models.DTOs;

public record FingerprintSummaryResponse(
    string Platform,
    string BrowserVersion,
    string UserAgent,
    string Screen,
    string ScreenWidth,
    string ScreenHeight,
    double ScreenPixelRatio,
    string Timezone,
    string AcceptLanguage,
    List<string> Languages,
    int HardwareConcurrency,
    int DeviceMemory,
    string Architecture,
    string Bitness,
    string WebGLVendor,
    string WebGLRenderer,
    string WebGLMode,
    double? WebGLNoiseLevel,
    string CanvasMode,
    double? CanvasNoiseLevel,
    string WebGLImageMode,
    string PluginsMode,
    string FontsMode,
    List<string> Fonts,
    string WebRTcMode,
    string SslMode,
    string ConnectionType,
    double? ConnectionDownlink,
    int? ConnectionRtt,
    string PortScan,
    string PortBlockMode,
    List<string> PortBlockList,
    string MediaDevicesMode,
    int? MediaVideoInputs,
    int? MediaAudioInputs,
    int? MediaAudioOutputs,
    string SpeechVoicesMode,
    string ClientRectsMode,
    double? ClientRectsNoiseLevel,
    string PlatformString,
    string TLSOSMatch,
    long? StorageQuota,
    ProfileDataConfig? RawConfig = null
);

public record ProfileCreateRequest(
    string Name,
    int? GroupId,
    List<int>? TagIds,
    int? ProxyId,
    string BrowserType,
    string? BrowserVersion,
    string? ProfileData,
    string? Notes,
    string? StartUrl,
    string? CookiesData,
    string? CookiesFileName,
    string? Cookies,
    FingerprintOptions? Fingerprint = null
);

public record FingerprintOptions(
    string? Platform,
    string? OSModel,
    bool UseRealUserAgent,
    string? UserAgent,
    string? UaMode,
    string? BrowserVersion,
    string? Language,
    string? AcceptLanguage,
    string? ScreenMode,
    string? HardwareMode,
    int? ScreenWidth,
    int? ScreenHeight,
    double? ScreenPixelRatio,
    string? Timezone,
    List<string>? Languages,
    int? HardwareConcurrency,
    int? DeviceMemory,
    string? CpuMode,
    string? AudioMode,
    int? AudioSampleRate,
    string? LocationMode,
    double? Latitude,
    double? Longitude,
    int? Accuracy,
    string? WebGLMode,
    string? WebGLVendor,
    string? WebGLRenderer,
    string? CanvasMode,
    string? WebGLImageMode,
    string? PluginsMode,
    string? FontsMode,
    List<string>? Fonts,
    string? WebRtcMode,
    string? SslMode,
    string? PortScan,
    string? PortBlockMode,
    List<string>? PortBlockList,
    string? MediaDevicesMode,
    string? SpeechVoicesMode,
    string? ClientRectsMode,
    string? FontMetricsMode,
    string? FontMetricsNoiseSeed,
    double? FontMetricsNoiseLevel,
    string? DoNotTrack,
    ProfileProxyOptions? Proxy
);

public record ProfileProxyOptions(
    string? Mode,
    string? Type,
    string? Host,
    int? Port,
    string? Username,
    string? Password,
    int? SavedProxyId
);

public record ProxyCheckRequest(
    string Type,
    string Host,
    int Port,
    string? Username,
    string? Password
);

public record ProfileUpdateRequest(
    int Id,
    string Name,
    int? GroupId,
    List<int>? TagIds,
    int? ProxyId,
    string BrowserType,
    string? BrowserVersion,
    string ProfileData,
    string? Notes,
    string? Cookies
);

public record BulkDeleteRequest(List<int> Ids);
public record BulkStartRequest(List<int> Ids);
public record BulkStopRequest(List<int> Ids);
public record BulkAssignGroupRequest(List<int> Ids, int? GroupId);

public record BulkCreateRequest(
    int? Quantity,
    string? Prefix,
    int? GroupId,
    List<int>? TagIds,
    int? ProxyId,
    string BrowserType,
    string? Notes,
    FingerprintOptions? Fingerprint
);

public record GroupCreateRequest(string Name);
public record GroupUpdateRequest(int Id, string Name);
public record TagCreateRequest(string Name);
public record TagUpdateRequest(int Id, string Name);
public record TagDeleteRequest(int Id);

// Proxy Group/Tag requests
public record ProxyGroupCreateRequest(string Name);
public record ProxyGroupUpdateRequest(int Id, string Name);
public record ProxyGroupDeleteRequest(int Id);
public record ProxyTagCreateRequest(string Name);
public record ProxyTagUpdateRequest(int Id, string Name);
public record ProxyTagDeleteRequest(int Id);

public record ProxyCreateRequest(
    string? Name,
    string? Type,
    int? GroupId,
    List<int>? TagIds,
    string? RotaryApi,
    string Host,
    int Port,
    string? Username,
    string? Password,
    string? Notes
);

public record ProxyUpdateRequest(
    int Id,
    string? Name,
    string? Type,
    int? GroupId,
    List<int>? TagIds,
    string? RotaryApi,
    string? Host,
    int? Port,
    string? Username,
    string? Password,
    string? Notes
);

public record ProxyListResponse(int Total, List<ProxyListItem> Items);

public record ProxyListItem(
    int Id,
    string Name,
    string Type,
    int? GroupId,
    string? GroupName,
    List<int> TagIds,
    List<string> TagNames,
    string Host,
    int Port,
    string? Username,
    string? Password,
    string? RotaryApi,
    string? Notes,
    string Status,
    string? Message,
    int? LatencyMs,
    DateTime CreatedAt
);

public record ProxyNameUpdateRequest(int Id, string Name);
public record ProxyNotesUpdateRequest(int Id, string Notes);
public record ProxyBulkCreateRequest(List<string> Proxies);
