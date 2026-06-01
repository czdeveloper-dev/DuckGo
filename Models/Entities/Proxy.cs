namespace DuckGo.Models.Entities;

public class Proxy
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "http";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}
