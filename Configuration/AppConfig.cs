using System.IO;

namespace DuckGo;

public static class AppConfig
{
    private static readonly string LocalAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

    public static string BaseDir => Path.Combine(LocalAppData, ".DuckGo");
    public static string DatabaseDir => Path.Combine(BaseDir, "Database");
    public static string DatabasePath => Path.Combine(DatabaseDir, "duckgo.db");
    public static string ProfilesDir => Path.Combine(BaseDir, "Profiles");
    public static string BrowserDir => Path.Combine(BaseDir, "Browser");
    public static string BrowserVersionsConfigUrl => "https://example.com/browser_versions.json";
    public static string UpdatesDir => Path.Combine(BaseDir, "Updates");

    public const string PipeName = "DuckBrowser_Control";
    public const int PipeConnectTimeoutMs = 5000;
    public const int PipeReadTimeoutMs = 5000;
    public const string ChromeExeName = "chrome.exe";

    public static TimeSpan HeartbeatInterval => TimeSpan.FromSeconds(10);
}
