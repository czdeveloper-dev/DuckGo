using System;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;

namespace DuckGo;

public partial class MainWindow : Window
{
    private static readonly string ResourcePrefix = "DuckGo.UI.";
    private string? _uiFolder;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        StateChanged += OnStateChanged;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await WebView.EnsureCoreWebView2Async();

        WebView.CoreWebView2.Settings.IsScriptEnabled = true;
        WebView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = false;
        WebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        WebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;

        // Extract UI files to temp folder
        _uiFolder = ExtractUiFiles();
        if (_uiFolder == null)
        {
            MessageBox.Show("Failed to extract UI files", "DuckGo Error");
            return;
        }

        // Map virtual host "duckgo.local" to the extracted folder
        // HTML can now use absolute URLs like http://duckgo.local/main.css
        WebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "duckgo.local",
            _uiFolder,
            CoreWebView2HostResourceAccessKind.Allow
        );

        WebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        PreviewKeyDown += OnPreviewKeyDown;

        // Navigate using the virtual host
        WebView.CoreWebView2.Navigate("http://duckgo.local/index.html");
    }

    private string? ExtractUiFiles()
    {
        try
        {
            var tempPath = Path.Combine(Path.GetTempPath(), "DuckGo_UI");
            
            // Clean old files first
            if (Directory.Exists(tempPath))
            {
                try { Directory.Delete(tempPath, true); } catch { }
            }
            
            Directory.CreateDirectory(tempPath);

            var assembly = Assembly.GetExecutingAssembly();
            foreach (var name in assembly.GetManifestResourceNames())
            {
                if (!name.StartsWith(ResourcePrefix)) continue;

                // Convert resource name to file path
                // "DuckGo.UI.index.html" -> "index.html"
                // "DuckGo.UI.core.app.js" -> "core/app.js"
                var relativePath = name.Substring(ResourcePrefix.Length);
                var lastDot = relativePath.LastIndexOf('.');
                if (lastDot > 0)
                {
                    var nameWithoutExt = relativePath.Substring(0, lastDot);
                    var ext = relativePath.Substring(lastDot);
                    relativePath = nameWithoutExt.Replace('.', Path.DirectorySeparatorChar) + ext;
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

            Console.WriteLine($"[DuckGo] UI folder: {tempPath}");
            return tempPath;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DuckGo] Extract error: {ex.Message}");
            return null;
        }
    }

    private void OnStateChanged(object? sender, EventArgs e)
    {
        if (WindowState == WindowState.Maximized)
        {
            MaximizeIcon.Children.Clear();
            MaximizeIcon.Children.Add(new System.Windows.Controls.TextBlock
            {
                Text = "\uE923",
                FontFamily = new System.Windows.Media.FontFamily("Segoe MDL2 Assets"),
                FontSize = 10
            });
            BtnMaximize.ToolTip = "Restore";
        }
        else
        {
            MaximizeIcon.Children.Clear();
            MaximizeIcon.Children.Add(new System.Windows.Controls.TextBlock
            {
                Text = "\uE922",
                FontFamily = new System.Windows.Media.FontFamily("Segoe MDL2 Assets"),
                FontSize = 10
            });
            BtnMaximize.ToolTip = "Maximize";
        }
    }

    private void BtnMinimize_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void BtnMaximize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }
    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.F12)
        {
            WebView.CoreWebView2?.OpenDevToolsWindow();
            e.Handled = true;
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        // TODO: wire up handlers
    }

    protected override void OnClosed(EventArgs e)
    {
        // Cleanup temp folder
        if (!string.IsNullOrEmpty(_uiFolder) && Directory.Exists(_uiFolder))
        {
            try { Directory.Delete(_uiFolder, true); } catch { }
        }
        base.OnClosed(e);
    }
}
