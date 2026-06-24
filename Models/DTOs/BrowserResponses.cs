using DuckGo.Models.Configs;

namespace DuckGo.Models.DTOs;

public class BrowserCatalogResponse
{
    public List<BrowserDefinitionResponse> Browsers { get; set; } = new();
}

public class BrowserDefinitionResponse
{
    public string BrowserType { get; set; } = "";
    public List<BrowserVersionItemResponse> Versions { get; set; } = new();
}

public class BrowserVersionItemResponse
{
    public string Version { get; set; } = "";
    public string Description { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string Md5 { get; set; } = "";
    public string Sha256 { get; set; } = "";
}
