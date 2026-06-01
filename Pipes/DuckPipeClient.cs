using System.Diagnostics;
using System.IO;

namespace DuckGo.Pipes;

public class DuckPipeClient : IDisposable
{
    private readonly string _pipeName;
    private readonly int _connectTimeoutMs;
    private readonly Dictionary<string, PipeConnection> _connections = new();

    public DuckPipeClient(string pipeName, int connectTimeoutMs)
    {
        _pipeName = pipeName;
        _connectTimeoutMs = connectTimeoutMs;
    }

    public async Task<bool> ConnectAsync(string profileId)
    {
        if (_connections.ContainsKey(profileId)) return true;

        var conn = new PipeConnection(_pipeName, _connectTimeoutMs);
        var connected = await conn.ConnectAsync();
        if (connected)
        {
            _connections[profileId] = conn;
            return true;
        }
        conn.Dispose();
        return false;
    }

    public async Task<string?> SendAsync(string profileId, PipeMessage message)
    {
        if (!_connections.TryGetValue(profileId, out var conn))
            return null;

        message.ProfileId = profileId;
        return await conn.SendReceiveAsync(message.Serialize());
    }

    public async Task<string?> SendConnectAsync(string profileId, string configJson, string? fsConfigJson, string? resourceLimitsJson)
    {
        var msg = new PipeMessage
        {
            Type = "CONNECT",
            ProfileId = profileId,
            Data = new
            {
                Config = configJson,
                FsConfig = fsConfigJson,
                ResourceLimits = resourceLimitsJson
            }
        };
        return await SendAsync(profileId, msg);
    }

    public async Task<string?> SendStopAsync(string profileId)
    {
        var msg = new PipeMessage { Type = "STOP", ProfileId = profileId };
        return await SendAsync(profileId, msg);
    }

    public async Task<string?> SendPingAsync(string profileId)
    {
        var msg = new PipeMessage { Type = "PING", ProfileId = profileId };
        return await SendAsync(profileId, msg);
    }

    public void Disconnect(string profileId)
    {
        if (_connections.TryGetValue(profileId, out var conn))
        {
            conn.Disconnect();
            conn.Dispose();
            _connections.Remove(profileId);
        }
    }

    public void Dispose()
    {
        foreach (var conn in _connections.Values)
            conn.Dispose();
        _connections.Clear();
    }

    public static Process? SpawnChrome(int remoteDebuggingPort, string profileDir)
    {
        var chromePath = FindChromePath();
        if (string.IsNullOrEmpty(chromePath)) return null;

        var args = $"--remote-debugging-port={remoteDebuggingPort} --profile-directory=\"{profileDir}\"";
        return Process.Start(new ProcessStartInfo(chromePath, args) { UseShellExecute = false });
    }

    private static string? FindChromePath()
    {
        var paths = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe"),
        };

        return paths.FirstOrDefault(File.Exists);
    }
}
