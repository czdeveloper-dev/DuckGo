using System.Text.Json;

namespace DuckGo.Services;

/// <summary>
/// Manages the browser download progress toast rendered inside WebView2.
/// Sends structured messages via the WebView2 bridge (bridge.js → Toast.push).
/// Does NOT manage any WPF UI elements.
/// </summary>
public class DownloadToastService : IDisposable
{
    private Action<string, object>? _push;
    private bool _isShowing;
    private bool _isCompleted;

    public event EventHandler? DownloadCompleted;
    public event EventHandler<string>? DownloadFailed;
    public event EventHandler? DownloadCancelled;

    public bool IsShowing => _isShowing;

    public void Initialize(Action<string, object> push)
    {
        _push = push;
    }

    public void Show(string title, string subtitle = "", bool locked = true)
    {
        if (_push == null || _isShowing) return;

        _isShowing = true;
        _isCompleted = false;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "show",
            Type = "progress",
            Title = title,
            Subtitle = subtitle,
            ProgressValue = 0,
            Downloaded = "0 B",
            Total = "0 B",
            Status = "Starting..."
        });
    }

    public void UpdateProgress(int progress, string downloadedText, string totalText, string status)
    {
        if (_push == null || !_isShowing) return;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "update",
            Type = "progress",
            ProgressValue = Math.Clamp(progress, 0, 100),
            Downloaded = downloadedText,
            Total = totalText,
            Status = status
        });
    }

    public void SetStatus(string status)
    {
        if (_push == null || !_isShowing) return;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "update",
            Type = "progress",
            Status = status
        });
    }

    public void Complete(string title, string message)
    {
        if (_push == null || _isCompleted) return;
        _isCompleted = true;
        _isShowing = false;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "complete",
            Type = "progress",
            Title = title,
            Message = message
        });

        DownloadCompleted?.Invoke(this, EventArgs.Empty);
    }

    public void Fail(string title, string message)
    {
        if (_push == null || _isCompleted) return;
        _isCompleted = true;
        _isShowing = false;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "fail",
            Type = "progress",
            Title = title,
            Message = message
        });

        DownloadFailed?.Invoke(this, message);
    }

    public void Cancel()
    {
        if (_push == null) return;
        _isCompleted = true;
        _isShowing = false;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "hide",
            Type = "progress"
        });

        DownloadCancelled?.Invoke(this, EventArgs.Empty);
    }

    public void Hide()
    {
        if (_push == null || !_isShowing) return;
        _isShowing = false;

        _push("download-toast", new DownloadToastMessage
        {
            Action = "hide",
            Type = "progress"
        });
    }

    public void Dispose() { }
}

internal class DownloadToastMessage
{
    public string Action { get; set; } = "";
    public string Type { get; set; } = "progress";
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public int ProgressValue { get; set; }
    public string Downloaded { get; set; } = "";
    public string Total { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
}
