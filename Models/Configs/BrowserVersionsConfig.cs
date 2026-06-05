namespace DuckGo.Models.Configs;

public class BrowserVersionsConfig
{
    public List<BrowserDefinition> Browsers { get; set; } = new();
}

public class BrowserDefinition
{
    public string BrowserType { get; set; } = "";
    public List<BrowserVersionEntry> Versions { get; set; } = new();
}

public class BrowserVersionEntry
{
    public string Version { get; set; } = "";
    public string Description { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string Md5 { get; set; } = "";
}
