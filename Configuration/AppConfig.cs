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
    public static string DownloadsDir => Path.Combine(BaseDir, "Downloads");

    public static string BrowserVersionsConfigUrl =>
        "https://raw.githubusercontent.com/czdeveloper-dev/DuckGo/refs/heads/master/Assets/browser_versions.json";

    public static string FingerprintTemplateUrl =>
        "https://raw.githubusercontent.com/czdeveloper-dev/DuckGo/refs/heads/master/Assets/default_fingerprint.json";

    public const string PipeName = "DuckBrowser_Control";
    public const int PipeConnectTimeoutMs = 300;
    public const int PipeReadTimeoutMs = 300;
    public const string ChromeExeName = "chrome.exe";
    public const int StartPort = 9222;

    public static TimeSpan HeartbeatInterval => TimeSpan.FromSeconds(10);

    // 32-byte (256-bit) AES key for encrypting the Resource column.
    public static readonly string ResourceEncryptionKey = "duckgo_secure_aes_key_32_bytes!!";
}
