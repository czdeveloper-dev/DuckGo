using System;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Runtime.InteropServices;
using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using DuckGo.Data;
using DuckGo.Data.Repositories;
using DuckGo.Infrastructure.API;
using DuckGo.Pipes;
using DuckGo.Services;

namespace DuckGo;

public partial class MainWindow : Window
{
    private DatabaseService? _db;
    private ProfileService? _profileService;
    private ProfileGroupService? _groupService;
    private ProfileTagService? _tagService;
    private ProxyService? _proxyService;
    private MessageDispatcher? _dispatcher;

    private BrowserCatalogService? _browserCatalogService;
    private BrowserVersionService? _browserVersionService;
    private BrowserProvisioningService? _browserProvisioningService;
    private BrowserLifecycleService? _browserLifecycleService;
    private ProfileStatusService? _profileStatusService;
    private ToastService? _toastService;
    private DuckPipeClient? _pipeClient;

    private IProfileRepository? _profileRepo;
    private readonly Dictionary<string, byte[]> _uiResourceCache = new();
    private readonly List<MemoryStream> _activeStreams = new();
    private readonly Dictionary<string, string> _mimeTypes = new()
    {
        { ".html", "text/html; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".js", "application/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" },
        { ".svg", "image/svg+xml" },
        { ".ico", "image/x-icon" },
        { ".woff", "font/woff" },
        { ".woff2", "font/woff2" },
        { ".ttf", "font/ttf" },
        { ".eot", "application/vnd.ms-fontobject" },
        { ".map", "application/json" }
    };

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            // Load icon from embedded resource file
            var resourceName = Assembly.GetExecutingAssembly().GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("DuckGo.ico"));
            if (resourceName != null)
            {
                using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
                if (stream != null)
                {
                    var bitmap = new System.Windows.Media.Imaging.BitmapImage();
                    bitmap.BeginInit();
                    bitmap.StreamSource = stream;
                    bitmap.CacheOption = System.Windows.Media.Imaging.BitmapCacheOption.OnLoad;
                    bitmap.EndInit();
                    bitmap.Freeze();
                    this.Icon = bitmap;
                }
            }

            _db = new DatabaseService();
            await _db.InitializeAsync();

            var proxyRepo = new ProxyRepository(_db);
            var profileGroupRepo = new ProfileGroupRepository(_db);
            var profileTagRepo = new ProfileTagRepository(_db);
            _profileRepo = new ProfileRepository(_db);
            var proxyTypeRepo = new ProxyTypeRepository(_db);
            var installedBrowserRepo = new InstalledBrowserRepository(_db);
            var settingsRepo = new SettingsRepository(_db);

            _groupService = new ProfileGroupService(profileGroupRepo);
            _tagService = new ProfileTagService(profileTagRepo);
            _proxyService = new ProxyService(proxyRepo, profileGroupRepo, profileTagRepo, proxyTypeRepo, _profileRepo, settingsRepo);
            var fingerprintSvc = new FingerprintService();
            _profileService = new ProfileService(_profileRepo, profileGroupRepo, profileTagRepo, proxyRepo, fingerprintSvc);

            _pipeClient = new DuckPipeClient(AppConfig.PipeName, AppConfig.PipeConnectTimeoutMs);
            _browserCatalogService = new BrowserCatalogService();
            _browserVersionService = new BrowserVersionService();

            Action<Models.DTOs.ProfileMessageUpdate> onMessageUpdate = msg => { };

            Action<string, object> onPush = (channel, payload) => { };

            Action<Models.DTOs.ToastPayload> onToast = toast =>
            {
                try
                {
                    var json = System.Text.Json.JsonSerializer.Serialize(
                        new { type = "push", channel = "toast", payload = toast });
                    WebView.CoreWebView2?.PostWebMessageAsJson(json);
                }
                catch { }
            };

            Action<int, string> onProfileMessage = (profileId, message) =>
            {
                try
                {
                    var json = System.Text.Json.JsonSerializer.Serialize(
                        new { type = "push", channel = "profile.message", payload = new { profileId, message } });

                    if (System.Windows.Application.Current?.Dispatcher.CheckAccess() == true)
                    {
                        WebView.CoreWebView2?.PostWebMessageAsJson(json);
                    }
                    else
                    {
                        System.Windows.Application.Current?.Dispatcher.InvokeAsync(() => {
                            WebView.CoreWebView2?.PostWebMessageAsJson(json);
                        });
                    }
                }
                catch { }
            };

            _profileStatusService = new ProfileStatusService(onMessageUpdate, onProfileMessage);
            _browserProvisioningService = new BrowserProvisioningService(
                _browserCatalogService, installedBrowserRepo, onToast, onMessageUpdate, onProfileMessage);

            var browserPath = GetInstalledBrowserPath();
            var duckBrowserManager = new DuckBrowserManager(browserPath);

            _browserLifecycleService = new BrowserLifecycleService(
                _profileRepo, _browserCatalogService, _browserProvisioningService,
                _profileStatusService, _pipeClient, duckBrowserManager, onToast);
            _toastService = new ToastService(onToast);

            _dispatcher = new MessageDispatcher(new IDispatcher[]
            {
                new BrowserDispatcher(_browserLifecycleService!, _browserVersionService!),
                new FingerprintDispatcher(fingerprintSvc),
                new ProfileDispatcher(_profileService!, fingerprintSvc, _profileStatusService!, _proxyService!),
                new ProfileGroupDispatcher(_groupService!),
                new ProfileTagDispatcher(_tagService!),
                new ProxyDispatcher(_proxyService!),
                new ProxyTypeDispatcher(proxyTypeRepo),
                new ClipboardDispatcher(),
            });

            WebView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 244, 246, 248);

            var userDataFolder = Path.Combine(AppConfig.BaseDir, "WebView2", "UserData");
            Directory.CreateDirectory(userDataFolder);

            var env = await Microsoft.Web.WebView2.Core.CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userDataFolder);

            await WebView.EnsureCoreWebView2Async(env);

            WebView.CoreWebView2.Settings.IsScriptEnabled = true;
            WebView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = false;
            WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            WebView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            WebView.CoreWebView2.Settings.IsWebMessageEnabled = true;

            // Clear WebView2 cache to ensure fresh CSS/JS loads
            try {
                var profilePath = WebView.CoreWebView2.Environment.UserDataFolder;
                var cachePath = Path.Combine(profilePath, "Cache");
                if (Directory.Exists(cachePath)) {
                    foreach (var dir in Directory.GetDirectories(cachePath))
                        try { Directory.Delete(dir, true); } catch { }
                }
                var codeCachePath = Path.Combine(profilePath, "Code Cache");
                if (Directory.Exists(codeCachePath))
                    try { Directory.Delete(codeCachePath, true); } catch { }
                Debug.WriteLine($"[UI] Cache cleared: {cachePath}");
            } catch (Exception ex) {
                Debug.WriteLine($"[UI] Cache clear failed: {ex.Message}");
            }

            try {
                LoadResourcesToMemory("DuckGo.UI.");
            } catch (Exception ex) {
                MessageBox.Show($"Load error: {ex.Message}\n{ex.StackTrace}");
            }
            if (_uiResourceCache.Count == 0)
            {
                MessageBox.Show("Failed to load UI resources into memory", "DuckGo Error");
                return;
            }

            WebView.CoreWebView2.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            WebView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;

            WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            PreviewKeyDown += OnPreviewKeyDown;

            WebView.CoreWebView2.Navigate("http://duckgo.local/index.html");


        }
        catch (Exception ex)
        {
            MessageBox.Show($"OnLoaded failed:\n{ex.Message}\n\n{ex.StackTrace}", "DuckGo Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private string GetInstalledBrowserPath()
    {
        var browserDir = Path.Combine(AppConfig.BrowserDir, "Chromium");

        if (Directory.Exists(browserDir))
        {
            var versions = Directory.GetDirectories(browserDir)
                .Select(d => new { Path = d, Version = Path.GetFileName(d) })
                .OrderByDescending(x => x.Version)
                .ToList();

            foreach (var v in versions)
            {
                var chromePath = Path.Combine(v.Path, "chrome.exe");
                if (File.Exists(chromePath))
                {
                    return chromePath;
                }
            }

            var files = Directory.GetFiles(browserDir, "chrome.exe", SearchOption.AllDirectories);
            if (files.Length > 0)
            {
                return files[0];
            }
        }

        return Path.Combine(browserDir, "chrome.exe");
    }

    private string? LoadResourcesToMemory(string prefix)
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            var allNames = assembly.GetManifestResourceNames();
            Debug.WriteLine($"[UI] Total embedded resources: {allNames.Length}");
            foreach (var n in allNames) Debug.WriteLine($"[UI]   resource: {n}");
            var count = 0;

            foreach (var name in allNames)
            {
                if (!name.StartsWith(prefix)) continue;

                var relativePath = name.Substring(prefix.Length);
                var lastDot = relativePath.LastIndexOf('.');
                if (lastDot > 0)
                {
                    var ext = relativePath.Substring(lastDot);
                    relativePath = relativePath.Substring(0, lastDot).Replace('.', '/') + ext;
                }

                using var stream = assembly.GetManifestResourceStream(name);
                if (stream != null)
                {
                    using var ms = new MemoryStream();
                    stream.CopyTo(ms);
                    _uiResourceCache[relativePath] = ms.ToArray();
                    count++;
                }
            }

            Debug.WriteLine($"[UI] === Resource Loading Complete: {count} resources (memory only) ===");
            return null; // No disk path — resources served directly from memory
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[UI] LoadResourcesToMemory error: {ex.Message}");
            return null;
        }
    }

    // Deprecated: UI resources are now served directly from memory via OnWebResourceRequested
    private string? ExtractUiToTempFolder()
    {
        return null;
    }

    private string? GetResourceContent(string path)
    {
        if (path.StartsWith("/")) path = path.Substring(1);
        if (path.StartsWith("http://duckgo.local/"))
            path = path.Substring("http://duckgo.local/".Length);

        if (_uiResourceCache.TryGetValue(path, out var data))
        {
            var ext = Path.GetExtension(path).ToLowerInvariant();
            if (ext == ".html" || ext == ".css" || ext == ".js" || ext == ".json" || ext == ".svg" || ext == ".map")
            {
                if (data.Length >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF)
                    return System.Text.Encoding.UTF8.GetString(data, 3, data.Length - 3);
                if (data.Length >= 2 && data[0] == 0xFF && data[1] == 0xFE)
                    return System.Text.Encoding.Unicode.GetString(data, 2, data.Length - 2);

                try { return System.Text.Encoding.UTF8.GetString(data); }
                catch { return System.Text.Encoding.Default.GetString(data); }
            }
        }
        return null;
    }

    private byte[]? GetResourceBytes(string path)
    {
        if (path.StartsWith("/")) path = path.Substring(1);
        if (path.StartsWith("http://duckgo.local/"))
            path = path.Substring("http://duckgo.local/".Length);
        if (path.StartsWith("http://duckgo.local"))
            path = path.Substring("http://duckgo.local".Length);

        var queryIndex = path.IndexOf('?');
        if (queryIndex > 0) path = path.Substring(0, queryIndex);

        if (_uiResourceCache.TryGetValue(path, out var data))
            return data;

        var lastSlash = path.LastIndexOf('/');
        if (lastSlash >= 0)
        {
            var fileName = path.Substring(lastSlash + 1);
            foreach (var key in _uiResourceCache.Keys)
            {
                if (key.EndsWith("/" + fileName) || key.EndsWith("\\" + fileName))
                {
                    return _uiResourceCache[key];
                }
            }
        }

        return null;
    }

    private string GetMimeType(string path)
    {
        var ext = Path.GetExtension(path).ToLowerInvariant();
        return _mimeTypes.TryGetValue(ext, out var mime) ? mime : "application/octet-stream";
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = e.Request.Uri;

        string path;
        if (uri.StartsWith("http://duckgo.local/"))
        {
            path = uri.Substring("http://duckgo.local/".Length);
        }
        else if (uri.StartsWith("http://duckgo.local"))
        {
            path = uri.Substring("http://duckgo.local".Length);
        }
        else
        {
            return;
        }

        if (string.IsNullOrEmpty(path) || path == "/") path = "index.html";

        var queryIndex = path.IndexOf('?');
        if (queryIndex > 0) path = path.Substring(0, queryIndex);

        var data = GetResourceBytes(path);
        if (data == null)
        {
            Debug.WriteLine($"[UI] 404 Not Found: {path}");
            e.Response = WebView.CoreWebView2.Environment.CreateWebResourceResponse(
                null, 404, "Not Found", "");
            return;
        }

        var mime = GetMimeType(path);

        var stream = new MemoryStream(data);
        stream.Position = 0;
        
        lock (_activeStreams) { _activeStreams.Add(stream); }

        e.Response = WebView.CoreWebView2.Environment.CreateWebResourceResponse(
            stream, 200, "OK",
            $"Content-Type: {mime}\r\n" +
            "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
            "Pragma: no-cache\r\n" +
            "Expires: 0\r\n" +
            $"Date: {DateTime.UtcNow:R}\r\n" +
            "Access-Control-Allow-Origin: *");
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.F12)
        {
            WebView.CoreWebView2?.OpenDevToolsWindow();
            e.Handled = true;
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var raw = e.WebMessageAsJson;
            if (string.IsNullOrWhiteSpace(raw)) return;

            if (_dispatcher == null) return;
            var responseJson = await _dispatcher!.DispatchAsync(raw);
            Dispatcher.Invoke(() => {
                WebView.CoreWebView2?.PostWebMessageAsJson(responseJson);
            });
        }
        catch (Exception ex)
        {
            try
            {
                var errJson = System.Text.Json.JsonSerializer.Serialize(
                    new { type = "response", id = 0, success = false, error = ex.Message });
                Dispatcher.Invoke(() => {
                    WebView.CoreWebView2?.PostWebMessageAsJson(errJson);
                });
            }
            catch { }
        }
    }

    public void Push(string channel, object payload)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(new { type = "push", channel, payload });
            Dispatcher.Invoke(() => {
                WebView.CoreWebView2?.PostWebMessageAsJson(json);
            });
        }
        catch { }
    }

    protected override void OnClosed(EventArgs e)
    {
        _pipeClient?.Dispose();
        _uiResourceCache.Clear();

        base.OnClosed(e);
    }

    public enum DWMWINDOWATTRIBUTE
    {
        DWMWA_USE_IMMERSIVE_DARK_MODE = 20,
        DWMWA_WINDOW_CORNER_PREFERENCE = 33,
        DWMWA_CAPTION_COLOR = 35,
        DWMWA_TEXT_COLOR = 36
    }

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, DWMWINDOWATTRIBUTE attr, ref int attrValue, int attrSize);

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        if (PresentationSource.FromVisual(this) is HwndSource source)
        {
            try
            {
                int trueValue = 1;
                DwmSetWindowAttribute(source.Handle, DWMWINDOWATTRIBUTE.DWMWA_USE_IMMERSIVE_DARK_MODE,
                    ref trueValue, Marshal.SizeOf(typeof(int)));

                int captionColor = 0x00302D2D;
                DwmSetWindowAttribute(source.Handle, DWMWINDOWATTRIBUTE.DWMWA_CAPTION_COLOR,
                    ref captionColor, Marshal.SizeOf(typeof(int)));

                int textColor = 0x00E0E0E0;
                DwmSetWindowAttribute(source.Handle, DWMWINDOWATTRIBUTE.DWMWA_TEXT_COLOR,
                    ref textColor, Marshal.SizeOf(typeof(int)));
            }
            catch { }
        }
    }
}
