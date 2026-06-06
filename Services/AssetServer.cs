using System;
using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace DuckGo.Services;

/// <summary>
/// Local HTTP server for serving embedded/external asset files.
/// Runs on a random available port and serves files from a configurable root directory.
/// This ensures Fingerprint and Browser version configs are always fresh on every startup
/// while keeping everything local — no GitHub dependency, no embedded-resource staleness.
/// </summary>
public class AssetServer : IDisposable
{
    private readonly HttpListener _listener;
    private readonly string _rootDir;
    private readonly CancellationTokenSource _cts;
    private Task? _listenTask;
    private bool _disposed;

    /// <summary>
    /// Base URL of the server, e.g. "http://localhost:51342"
    /// </summary>
    public string BaseUrl { get; private set; } = "";

    public AssetServer(string rootDir)
    {
        _rootDir = rootDir ?? throw new ArgumentNullException(nameof(rootDir));
        _listener = new HttpListener();
        _cts = new CancellationTokenSource();
    }

    /// <summary>
    /// Start the HTTP server on a random available port.
    /// </summary>
    public void Start()
    {
        if (_listenTask != null) return;

        // Find an available port
        var port = GetAvailablePort(51342, 52000);
        _listener.Prefixes.Add($"http://localhost:{port}/");
        _listener.Start();
        BaseUrl = $"http://localhost:{port}";

        _listenTask = Task.Run(() => ListenAsync(_cts.Token));
    }

    private async Task ListenAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested && _listener.IsListening)
        {
            try
            {
                var context = await _listener.GetContextAsync().WaitAsync(ct);
                _ = Task.Run(() => HandleRequest(context), ct);
            }
            catch (OperationCanceledException) { break; }
            catch (HttpListenerException) { break; }
            catch (ObjectDisposedException) { break; }
        }
    }

    private void HandleRequest(HttpListenerContext context)
    {
        var response = context.Response;
        try
        {
            var urlPath = context.Request.Url?.AbsolutePath.TrimStart('/') ?? "";
            var localPath = Path.GetFullPath(Path.Combine(_rootDir, urlPath));

            // Security: prevent path traversal
            if (!localPath.StartsWith(Path.GetFullPath(_rootDir), StringComparison.OrdinalIgnoreCase))
            {
                response.StatusCode = 403;
                response.Close();
                return;
            }

            if (File.Exists(localPath))
            {
                var mime = GetMimeType(localPath);
                response.ContentType = mime;
                response.StatusCode = 200;
                using var fs = File.OpenRead(localPath);
                fs.CopyTo(response.OutputStream);
            }
            else
            {
                response.StatusCode = 404;
                response.StatusDescription = "Not Found";
            }
        }
        catch (Exception)
        {
            response.StatusCode = 500;
        }
        finally
        {
            response.Close();
        }
    }

    private static int GetAvailablePort(int min, int max)
    {
        var random = new Random();
        for (int i = 0; i < 20; i++)
        {
            int port = random.Next(min, max);
            var listener = new HttpListener();
            try
            {
                listener.Prefixes.Add($"http://localhost:{port}/");
                listener.Start();
                listener.Stop();
                return port;
            }
            catch { /* try next */ }
            finally { listener.Close(); }
        }
        return min; // fallback
    }

    private static string GetMimeType(string path)
    {
        return Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".json" => "application/json",
            ".js"   => "application/javascript",
            ".css"  => "text/css",
            ".html" => "text/html",
            ".ico"  => "image/x-icon",
            ".png"  => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".svg"  => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _listener.Stop();
        _listener.Close();
        _cts.Dispose();
    }
}
