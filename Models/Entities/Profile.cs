using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DuckGo.Models.Entities;

public class Profile
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Resource { get; set; } = "";
    public int? GroupId { get; set; }
    public string TagIdsJson { get; set; } = "[]";
    public int? ProxyId { get; set; }
    public string? BrowserType { get; set; } // From catalog
    public string? BrowserVersion { get; set; } // From catalog
    public string ProfileData { get; set; } = "{}";
    public string Notes { get; set; } = "";
    public string Cookies { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? LastOpened { get; set; }
    [NotMapped]
    public string Message { get; set; } = "";
    
    [NotMapped]
    public string Status { get; set; } = "ready";

    [JsonIgnore]
    public string? GroupName { get; set; }

    [JsonIgnore]
    public string? ProxyName { get; set; }

    [JsonIgnore]
    public List<string> TagNames { get; set; } = new();

    [JsonIgnore]
    public List<int> TagIds { get; set; } = new();
}
