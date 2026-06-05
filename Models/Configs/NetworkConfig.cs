namespace DuckGo.Models.Configs;

public class NetworkConfig
{
    public ProxyConfig? Proxy { get; set; }
}

public class ProxyConfig
{
    public string Mode { get; set; } = "none";
    public int? SavedProxyId { get; set; }
    public string Type { get; set; } = "http";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
