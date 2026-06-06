namespace DuckGo.Models.DTOs;

public class ApiToast
{
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string Type { get; set; } = "error";
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public ApiToast? Toast { get; set; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
    public static ApiResponse<T> Fail(string error) => new() { Success = false, Error = error };
}

public class ApiResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public ApiToast? Toast { get; set; }

    public static ApiResponse Ok() => new() { Success = true };
    public static ApiResponse Fail(string error) => new() { Success = false, Error = error };
}

public class ProfileListResponse
{
    public List<ProfileListItem> Items { get; set; } = new();
    public int Total { get; set; }
}

public class ProfileListItem
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? GroupId { get; set; }
    public string? GroupName { get; set; }
    public List<int> TagIds { get; set; } = new();
    public List<string> TagNames { get; set; } = new();
    public int? ProxyId { get; set; }
    public string? ProxyName { get; set; }
    public string BrowserType { get; set; } = "Chromium";
    public string BrowserVersion { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Cookies { get; set; } = "[]";
    public string Status { get; set; } = "stopped";
    public DateTime CreatedAt { get; set; }
    public DateTime? LastOpened { get; set; }
}
