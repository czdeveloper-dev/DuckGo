namespace DuckGo.Models.DTOs;

public record ProfileCreateRequest(
    string Name,
    int? GroupId,
    List<int>? TagIds,
    int? ProxyId,
    string BrowserType,
    string? ProfileData,
    string? Notes,
    string? StartUrl,
    string? CookiesData,
    string? CookiesFileName,
    FingerprintOptions? Fingerprint = null
);

public record FingerprintOptions(
    string? Platform,
    string? OSModel,
    string? UserAgent,
    string? BrowserVersion,
    string? Language,
    string? AcceptLanguage,
    int? ScreenWidth,
    int? ScreenHeight,
    double? ScreenPixelRatio,
    string? Timezone,
    List<string>? Languages,
    int? HardwareConcurrency,
    int? DeviceMemory,
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
    string ProfileData,
    string? Notes
);

public record BulkDeleteRequest(List<int> Ids);
public record BulkStartRequest(List<int> Ids);
public record BulkStopRequest(List<int> Ids);
public record BulkAssignGroupRequest(List<int> Ids, int? GroupId);

public record GroupCreateRequest(string Name);
public record GroupUpdateRequest(int Id, string Name);
public record TagCreateRequest(string Name);
public record TagUpdateRequest(int Id, string Name);
public record TagDeleteRequest(int Id);

public record ProxyCreateRequest(
    string Name,
    string Type,
    string Host,
    int Port,
    string Username,
    string Password
);

public record ProxyUpdateRequest(
    int Id,
    string Name,
    string Type,
    string Host,
    int Port,
    string Username,
    string Password
);
