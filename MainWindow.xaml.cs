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
    private string? _uiFolder;
    private string? _assetFolder;

    private DatabaseService? _db;
    private ProfileService? _profileService;
    private GroupService? _groupService;
    private TagService? _tagService;
    private ProxyService? _proxyService;
    private MessageDispatcher? _dispatcher;

    private BrowserCatalogService? _browserCatalogService;
    private BrowserProvisioningService? _browserProvisioningService;
    private BrowserLifecycleService? _browserLifecycleService;
    private ProfileStatusService? _profileStatusService;
    private ToastService? _toastService;
    private DuckPipeClient? _pipeClient;

    private IProfileRepository? _profileRepo;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        Debug.WriteLine("[DuckGo] OnLoaded started");
        try
        {
            _db = new DatabaseService();
            await _db.InitializeAsync();
            Debug.WriteLine("[DuckGo] Database initialized");

            var groupRepo = new GroupRepository(_db);
            var tagRepo = new TagRepository(_db);
            var proxyRepo = new ProxyRepository(_db);
            _profileRepo = new ProfileRepository(_db);
            var proxyTypeRepo = new ProxyTypeRepository(_db);
            var installedBrowserRepo = new InstalledBrowserRepository(_db);

            _groupService = new GroupService(groupRepo);
            _tagService = new TagService(tagRepo);
            _proxyService = new ProxyService(proxyRepo);
            var fingerprintSvc = new FingerprintService();
            _profileService = new ProfileService(_profileRepo, groupRepo, tagRepo, proxyRepo, fingerprintSvc);
            Debug.WriteLine("[DuckGo] Services created");

            _pipeClient = new DuckPipeClient(AppConfig.PipeName, AppConfig.PipeConnectTimeoutMs);
            _browserCatalogService = new BrowserCatalogService();

            Action<Models.DTOs.ProfileMessageUpdate> onMessageUpdate = msg =>
            {
                Debug.WriteLine($"[DuckGo] ProfileMessage: profileId={msg.ProfileId} msg={msg.Message} status={msg.Status}");
            };

            Action<string, object> onPush = (channel, payload) =>
            {
                Debug.WriteLine($"[DuckGo] Push: channel={channel}");
            };

            Action<Models.DTOs.ToastPayload> onToast = toast =>
            {
                Debug.WriteLine($"[DuckGo] Toast: type={toast.Type} title={toast.Title} progress={toast.ProgressValue}");
                var json = System.Text.Json.JsonSerializer.Serialize(
                    new { type = "push", channel = "toast", payload = toast });
                WebView.CoreWebView2?.ExecuteScriptAsync($"window.__duckReceive({json})");
            };

            Action<int, string> onProfileMessage = (profileId, message) =>
            {
                var json = System.Text.Json.JsonSerializer.Serialize(
                    new { type = "push", channel = "profile.message", payload = new { profileId, message } });
                WebView.CoreWebView2?.ExecuteScriptAsync($"window.__duckReceive({json})");
            };

            _profileStatusService = new ProfileStatusService(_profileRepo, onMessageUpdate, onPush);
            _browserProvisioningService = new BrowserProvisioningService(
                _browserCatalogService, installedBrowserRepo, onToast, onMessageUpdate, onProfileMessage);
            _browserLifecycleService = new BrowserLifecycleService(
                _profileRepo, _browserCatalogService, _browserProvisioningService,
                _profileStatusService, _pipeClient, onToast, msg => { });
            _toastService = new ToastService(onToast);

            _dispatcher = new MessageDispatcher(new IDispatcher[]
            {
                new BrowserDispatcher(_browserLifecycleService!),
                new FingerprintDispatcher(fingerprintSvc),
                new ProfileDispatcher(_profileService!, fingerprintSvc),
                new GroupDispatcher(_groupService!),
                new TagDispatcher(_tagService!),
                new ProxyDispatcher(_proxyService!),
                new ProxyTypeDispatcher(proxyTypeRepo),
            });
            Debug.WriteLine("[DuckGo] Dispatcher created");

            WebView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(255, 244, 246, 248);
            await WebView.EnsureCoreWebView2Async();
            Debug.WriteLine("[DuckGo] WebView2 ready");

            WebView.CoreWebView2.Settings.IsScriptEnabled = true;
            WebView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = false;
            WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

            _uiFolder = ExtractResources("DuckGo.UI.", "UI");
            _assetFolder = ExtractResources("DuckGo.Assets.", "Assets");
            if (_uiFolder == null)
            {
                MessageBox.Show("Failed to extract UI files", "DuckGo Error");
                return;
            }
            Debug.WriteLine($"[DuckGo] UI folder: {_uiFolder}");
            if (_assetFolder != null) Debug.WriteLine($"[DuckGo] Asset folder: {_assetFolder}");

            WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "duckgo.local", _uiFolder, CoreWebView2HostResourceAccessKind.Allow);

            WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
            PreviewKeyDown += OnPreviewKeyDown;
            Debug.WriteLine("[DuckGo] Navigating to index.html...");
            WebView.CoreWebView2.Navigate("http://duckgo.local/index.html");
            Debug.WriteLine("[DuckGo] OnLoaded completed successfully");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DuckGo] OnLoaded EXCEPTION: {ex}");
            MessageBox.Show($"OnLoaded failed:\n{ex.Message}\n\n{ex.StackTrace}", "DuckGo Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private string? ExtractResources(string prefix, string folderName)
    {
        try
        {
            var tempPath = Path.Combine(Path.GetTempPath(), $"DuckGo_{folderName}");
            if (Directory.Exists(tempPath)) { try { Directory.Delete(tempPath, true); } catch { } }
            Directory.CreateDirectory(tempPath);

            var assembly = Assembly.GetExecutingAssembly();
            foreach (var name in assembly.GetManifestResourceNames())
            {
                if (!name.StartsWith(prefix)) continue;

                var relativePath = name.Substring(prefix.Length);
                var lastDot = relativePath.LastIndexOf('.');
                if (lastDot > 0)
                {
                    relativePath = relativePath.Substring(0, lastDot).Replace('.', Path.DirectorySeparatorChar)
                                   + relativePath.Substring(lastDot);
                }

                var fullPath = Path.Combine(tempPath, relativePath);
                var dir = Path.GetDirectoryName(fullPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

                using var stream = assembly.GetManifestResourceStream(name);
                if (stream != null)
                {
                    using var fileStream = File.Create(fullPath);
                    stream.CopyTo(fileStream);
                }
            }

            Console.WriteLine($"[DuckGo] {folderName} folder: {tempPath}");
            return tempPath;
        }
        catch
        {
            return null;
        }
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
            WebView.CoreWebView2?.ExecuteScriptAsync($"window.__duckReceive({responseJson})");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[DuckGo] OnWebMessageReceived EXCEPTION: {ex}");
            try
            {
                var errJson = System.Text.Json.JsonSerializer.Serialize(
                    new { type = "response", id = 0, success = false, error = ex.Message });
                WebView.CoreWebView2?.ExecuteScriptAsync($"window.__duckReceive({errJson})");
            }
            catch { }
        }
    }

    public void Push(string channel, object payload)
    {
        try
        {
            var json = System.Text.Json.JsonSerializer.Serialize(new { type = "push", channel, payload });
            WebView.CoreWebView2?.ExecuteScriptAsync($"window.__duckReceive({json})");
        }
        catch { }
    }

    protected override void OnClosed(EventArgs e)
    {
        _pipeClient?.Dispose();
        if (!string.IsNullOrEmpty(_uiFolder) && Directory.Exists(_uiFolder))
        {
            try { Directory.Delete(_uiFolder, true); } catch { }
        }
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
