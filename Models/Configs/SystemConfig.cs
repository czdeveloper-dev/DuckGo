namespace DuckGo.Models.Configs;

public class SystemConfig
{
    public string Platform { get; set; } = "Win32";
    public string Language { get; set; } = "en-US";
    public string UserAgent { get; set; } = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    public string BrowserVersion { get; set; } = "126";
    public string AcceptLanguage { get; set; } = "en-US,en;q=0.9";
    public string Timezone { get; set; } = "America/New_York";
    public int HardwareConcurrency { get; set; } = 8;
    public int DeviceMemory { get; set; } = 8;
    public string Architecture { get; set; } = "x86";
    public string Bitness { get; set; } = "64";
    public ScreenConfig Screen { get; set; } = new();

    public static SystemConfig Default => new();
}

public class ScreenConfig
{
    public int Width { get; set; } = 1920;
    public int Height { get; set; } = 1080;
    public int ColorDepth { get; set; } = 24;
    public double PixelRatio { get; set; } = 1.0;
}
