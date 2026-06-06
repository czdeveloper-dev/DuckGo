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
    public static string UpdatesDir => Path.Combine(BaseDir, "Updates");

    /// <summary>
    /// Set by MainWindow at startup once the AssetServer starts.
    /// Services use this to fetch configs via HTTP instead of embedded resources.
    /// </summary>
    public static string AssetServerUrl { get; set; } = "";

    /// <summary>
    /// Always reads the freshest config from the asset server on every startup.
    /// </summary>
    public static string BrowserVersionsConfigUrl => $"{AssetServerUrl}/BrowserVersions/browser_versions.json";
    public static string FingerprintTemplateUrl  => $"{AssetServerUrl}/fingerprint/default_fingerprint.json";

    public const string PipeName = "DuckBrowser_Control";
    public const int PipeConnectTimeoutMs = 5000;
    public const int PipeReadTimeoutMs = 5000;
    public const string ChromeExeName = "chrome.exe";

    public static TimeSpan HeartbeatInterval => TimeSpan.FromSeconds(10);
}
