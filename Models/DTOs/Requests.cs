namespace DuckGo.Models.DTOs;

public record ProfileCreateRequest(
    string Name,
    int? GroupId,
    List<int>? TagIds,
    int? ProxyId,
    string BrowserType,
    string ProfileData,
    string? Notes
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
