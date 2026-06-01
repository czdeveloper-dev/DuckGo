namespace DuckGo.Models.Configs;

public class SecurityConfig
{
    public string PortBlockMode { get; set; } = "block_default";
    public List<string> PortBlockList { get; set; } = new();
}
