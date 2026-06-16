namespace DuckGo.Models.Entities;

public class Proxy
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int? TypeId { get; set; }  // Foreign key to ProxyTypes (CASCADE delete)
    public int? GroupId { get; set; }
    public string Tags { get; set; } = "[]";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string RotaryApi { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "unknown";
    public int? LatencyMs { get; set; }
    public string? Message { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation property
    public ProxyType? ProxyType { get; set; }

    // Display fields (populated by service layer)
    public string? GroupName { get; set; }
    public List<int> TagIds { get; set; } = new();
    public List<string> TagNames { get; set; } = new();
}
