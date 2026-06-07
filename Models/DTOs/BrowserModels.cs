namespace DuckGo.Models.DTOs;

public enum ToastKind
{
    Info,
    Success,
    Error,
    Progress
}

public class ToastPayload
{
    public string ToastId { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Type { get; set; } = "info";
    public int ProgressValue { get; set; } = -1;
    public string Status { get; set; } = "";
    public bool Persistent { get; set; } = false;

    public static ToastPayload Info(string title, string message) => new()
    {
        Title = title, Message = message, Type = "info"
    };

    public static ToastPayload Success(string title, string message) => new()
    {
        Title = title, Message = message, Type = "success"
    };

    public static ToastPayload Error(string title, string message) => new()
    {
        Title = title, Message = message, Type = "error"
    };

    public static ToastPayload Progress(string toastId, string title, string message, int progress, string status) => new()
    {
        ToastId = toastId, Title = title, Message = message,
        Type = "progress", ProgressValue = progress, Status = status, Persistent = true
    };

    public static ToastPayload Complete(string toastId, string title, string message) => new()
    {
        ToastId = toastId, Title = title, Message = message,
        Type = "success", Persistent = false
    };

    public static ToastPayload Failed(string toastId, string title, string message) => new()
    {
        ToastId = toastId, Title = title, Message = message,
        Type = "error", Persistent = false
    };
}

public class ProfileMessageUpdate
{
    public int ProfileId { get; set; }
    public string Message { get; set; } = "";
    public string? Status { get; set; }
}

public class BrowserCatalog
{
    public string BrowserType { get; set; } = "";
    public string Version { get; set; } = "";
    public string Description { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string Md5 { get; set; } = "";
    public string ExecutableRelativePath { get; set; } = "";
    public string ArchiveType { get; set; } = "zip";
}

public class InstalledBrowser
{
    public int Id { get; set; }
    public string BrowserType { get; set; } = "";
    public string BrowserVersion { get; set; } = "";
    public string InstallPath { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
    public DateTime InstalledAt { get; set; }
}

public class BrowserProvisioningResult
{
    public bool Success { get; set; }
    public string ExecutablePath { get; set; } = "";
    public string InstallPath { get; set; } = "";
    public string? Error { get; set; }
}

public class BrowserStartResult
{
    public bool Success { get; set; }
    public int ProfileId { get; set; }
    public string Status { get; set; } = "";
    public int CdpPort { get; set; }
    public string? Error { get; set; }
}

public class BrowserStopResult
{
    public bool Success { get; set; }
    public int ProfileId { get; set; }
    public string? Error { get; set; }
}

public class InstalledBrowserEntry
{
    public string BrowserType { get; set; } = "";
    public string BrowserVersion { get; set; } = "";
    public string InstallPath { get; set; } = "";
    public string ExecutablePath { get; set; } = "";
    public DateTime InstalledAt { get; set; }
}
