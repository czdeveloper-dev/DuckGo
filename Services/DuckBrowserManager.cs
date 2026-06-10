using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using DuckGo.Models.Configs;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

/// <summary>
/// Manages DuckBrowser instances with Named Pipe handshake and CDP automation
/// Following the DuckBrowser protocol from duckbrowser_project_plan.md
/// </summary>
public class DuckBrowserManager : IDisposable
{
    private const string PipeName = "DuckBrowser_Control";
    private const int HeartbeatIntervalMs = 300; // Match DuckBrowser heartbeat
    private const int HeartbeatTimeoutMs = 5000;

    private readonly ConcurrentDictionary<int, BrowserInstance> _instances = new();
    private readonly string _browserPath;
    private readonly int _startPort;
    private readonly DuckBrowserConfigBuilder _configBuilder;

    public DuckBrowserManager(string browserPath, int startPort = 9222)
    {
        _browserPath = browserPath;
        _startPort = startPort;
        _configBuilder = new DuckBrowserConfigBuilder();
    }

    public async Task<BrowserLaunchResult> LaunchAsync(Models.Entities.Profile profile)
    {
        var profileId = profile.Id;
        var cdpPort = _startPort + profileId;

        // Check if browser path exists
        if (!File.Exists(_browserPath))
        {
            return new BrowserLaunchResult { Success = false, Error = $"Browser not found at {_browserPath}" };
        }

        try
        {
            // Step 0: Create profile directory
            var profileDir = Path.Combine(AppConfig.ProfilesDir, profileId.ToString());
            try
            {
                Directory.CreateDirectory(profileDir);
            }
            catch (Exception ex)
            {
                return new BrowserLaunchResult { Success = false, Error = $"Profile directory error: {ex.Message}" };
            }

            // Step 1: Build config from profile (before spawning)
            var config = _configBuilder.BuildFromProfile(profile);
            config.Profile = new DuckProfileConfig
            {
                ProfileID = profile.Id.ToString(),
                ProfileName = profile.Name,
                StartURL = profile.ProfileData != null 
                    ? TryGetStartUrl(profile.ProfileData) 
                    : null
            };

            // Step 2: Build command line args
            var args = $"--remote-debugging-port={cdpPort} " +
                       $"--profile-directory=\"{profileDir}\" " +
                       $"--user-data-dir=\"{profileDir}\" " +
                       $"--no-first-run " +
                       $"--no-default-browser-check";

            // Step 3: Start Chrome
            var psi = new ProcessStartInfo
            {
                FileName = _browserPath,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(_browserPath)
            };

            var process = Process.Start(psi);

            if (process == null)
            {
                return new BrowserLaunchResult { Success = false, Error = "Failed to start process" };
            }

            // Step 4: CRITICAL - Connect to pipe within timeout!
            // DuckBrowser waits kBackendConnectTimeout (now 10s) for backend connection
            
            DuckBrowserPipeConnection? pipeConnection = null;
            var pipeConnected = false;
            
            // Retry connect every 100ms for up to 9 seconds
            for (int i = 0; i < 90; i++)
            {
                try
                {
                    pipeConnection = new DuckBrowserPipeConnection(PipeName);
                    pipeConnected = await pipeConnection.ConnectAsync(200);
                    if (pipeConnected)
                    {
                        break;
                    }
                }
                catch { }
                
                await Task.Delay(100);
            }

            if (pipeConnected && pipeConnection != null)
            {
                // Step 5: Send CONNECT message with profile info + timestamp
                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var connectPayload = new
                {
                    profileId = profile.Id.ToString(),
                    profileName = profile.Name,
                    timestamp = timestamp.ToString(),
                    startUrl = config.Profile?.StartURL
                };
                
                var connectJson = JsonSerializer.Serialize(connectPayload);
                await pipeConnection.SendFramedMessageAsync("CONNECT", profile.Id.ToString(), connectJson);

                // Step 6: Wait for CDP_READY response
                var response = await pipeConnection.ReceiveMessageAsync(3000);

                if (response?.Type == "CDP_READY" || response?.Type == "READY")
                {
                    // Step 7: Send CONFIG
                    var configJson = JsonSerializer.Serialize(config, DuckPipeMessageContext.Default.DuckBrowserConfig);
                    await pipeConnection.SendFramedMessageAsync("CONFIG", profile.Id.ToString(), configJson);

                    // Step 8: Send FS_CONFIG
                    var fsConfig = new
                    {
                        FileSystem = new
                        {
                            ProfilePath = profileDir,
                            DownloadLocation = Path.Combine(AppConfig.DownloadsDir, profileId.ToString())
                        }
                    };
                    var fsJson = JsonSerializer.Serialize(fsConfig);
                    await pipeConnection.SendFramedMessageAsync("FS_CONFIG", profile.Id.ToString(), fsJson);

                    // Step 9: Send RESOURCE_LIMITS
                    var resConfig = new
                    {
                        ResourceLimits = new
                        {
                            max_memory_mb = 512,
                            target_memory_mb = 384,
                            max_cpu_percent = 50,
                            thread_limit = 8
                        }
                    };
                    var resJson = JsonSerializer.Serialize(resConfig);
                    await pipeConnection.SendFramedMessageAsync("RESOURCE_LIMITS", profile.Id.ToString(), resJson);

                    // Start heartbeat monitor
                    _ = MonitorHeartbeatAsync(pipeConnection, profileId);
                }
            }

            // Step 10: Wait a moment for browser to stabilize
            await Task.Delay(1000);

            // Verify browser is running
            if (process.HasExited)
            {
                pipeConnection?.Dispose();
                return new BrowserLaunchResult 
                { 
                    Success = false, 
                    Error = $"Browser exited with code {process.ExitCode}" 
                };
            }

            // Store instance
            var instance = new BrowserInstance
            {
                ProfileId = profileId,
                Process = process,
                CdpPort = cdpPort,
                PipeConnection = pipeConnection
            };

            _instances[profileId] = instance;

            // Handle process exit
            process.EnableRaisingEvents = true;
            process.Exited += (_, _) =>
            {
                _instances.TryRemove(profileId, out _);
                pipeConnection?.Dispose();
            };

            return new BrowserLaunchResult
            {
                Success = true,
                ProfileId = profileId,
                CdpPort = cdpPort
            };
        }
        catch (Exception ex)
        {
            return new BrowserLaunchResult { Success = false, Error = ex.Message };
        }
    }

    private async Task MonitorHeartbeatAsync(DuckBrowserPipeConnection? connection, int profileId)
    {
        if (connection == null) return;
        
        try
        {
            while (_instances.ContainsKey(profileId))
            {
                await Task.Delay(HeartbeatIntervalMs);

                try
                {
                    await connection.SendFramedMessageAsync("PING", profileId.ToString(), "{\"ping\":true}");
                    
                    // Wait for PONG
                    var response = await connection.ReceiveMessageAsync(1000);
                    if (response?.Type != "PONG")
                    {
                        // Heartbeat timeout - browser may have crashed
                        break;
                    }
                }
                catch
                {
                    // Heartbeat failed
                    break;
                }
            }
        }
        catch { }
    }

    public async Task<bool> StopAsync(int profileId)
    {
        if (!_instances.TryGetValue(profileId, out var instance))
            return true;

        try
        {
            // Send STOP message via pipe
            if (instance.PipeConnection?.IsConnected == true)
            {
                try
                {
                    await instance.PipeConnection.SendFramedMessageAsync("STOP", profileId.ToString(), "{}");
                }
                catch { }
            }

            if (!instance.Process.HasExited)
            {
                instance.Process.Kill();
            }

            await Task.Delay(500);
            _instances.TryRemove(profileId, out _);
            instance.PipeConnection?.Dispose();

            return true;
        }
        catch { return false; }
    }

    public BrowserInstance? GetInstance(int profileId)
    {
        _instances.TryGetValue(profileId, out var instance);
        return instance;
    }

    public IReadOnlyDictionary<int, BrowserInstance> GetAllInstances() => _instances;

    private static string? TryGetStartUrl(string profileData)
    {
        try
        {
            var cfg = JsonSerializer.Deserialize<ProfileDataConfig>(profileData);
            return cfg?.Profile?.StartURL;
        }
        catch { return null; }
    }

    public void Dispose()
    {
        foreach (var instance in _instances.Values)
        {
            try
            {
                if (!instance.Process.HasExited)
                {
                    instance.Process.Kill();
                }
                instance.PipeConnection?.Dispose();
            }
            catch { }
        }
        _instances.Clear();
    }
}

public class BrowserInstance
{
    public int ProfileId { get; set; }
    public Process Process { get; set; } = null!;
    public int CdpPort { get; set; }
    public DuckBrowserPipeConnection? PipeConnection { get; set; }
    public bool IsRunning => !Process.HasExited;
}

public class BrowserLaunchResult
{
    public bool Success { get; set; }
    public int ProfileId { get; set; }
    public int CdpPort { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Connection to DuckBrowser's Named Pipe using the proper frame format
/// Format: \x1E type \x1F profileId \x1F data \x1E
/// </summary>
public class DuckBrowserPipeConnection : IDisposable
{
    private const char FrameDelim = '\x1E';
    private const char FieldDelim = '\x1F';
    
    private readonly string _pipeName;
    private NamedPipeClientStream? _pipe;
    private bool _disposed;
    private readonly object _lock = new();

    public bool IsConnected => _pipe?.IsConnected ?? false;

    public DuckBrowserPipeConnection(string pipeName)
    {
        _pipeName = pipeName;
    }

    public async Task<bool> ConnectAsync(int timeoutMs)
    {
        try
        {
            _pipe = new NamedPipeClientStream(
                ".",
                _pipeName,
                PipeDirection.InOut,
                PipeOptions.Asynchronous);

            using var cts = new CancellationTokenSource(timeoutMs);
            
            // Use ConnectAsync with cancellation
            var connectTask = _pipe.ConnectAsync(timeoutMs);
            var completedTask = await Task.WhenAny(connectTask, Task.Delay(timeoutMs));
            
            if (completedTask == connectTask && _pipe.IsConnected)
            {
                return true;
            }
            
            return false;
        }
        catch { return false; }
    }

    /// <summary>
    /// Send a framed message using DuckBrowser protocol
    /// Format: FRAME_DELIM type FIELD_DELIM profileId FIELD_DELIM data FRAME_DELIM
    /// </summary>
    public async Task<bool> SendFramedMessageAsync(string type, string profileId, string data)
    {
        if (_pipe == null || !_pipe.IsConnected)
            return false;

        try
        {
            // Build framed message: \x1E type \x1F profileId \x1F data \x1E
            var framed = new StringBuilder();
            framed.Append(FrameDelim);
            framed.Append(type);
            framed.Append(FieldDelim);
            framed.Append(EscapeField(profileId));
            framed.Append(FieldDelim);
            framed.Append(EscapeField(data));
            framed.Append(FrameDelim);

            var bytes = Encoding.UTF8.GetBytes(framed.ToString());
            
            await _pipe.WriteAsync(bytes, 0, bytes.Length);
            await _pipe.FlushAsync();

            return true;
        }
        catch { return false; }
    }

    /// <summary>
    /// Receive and parse a framed message from DuckBrowser
    /// </summary>
    public async Task<DuckPipeMessage?> ReceiveMessageAsync(int timeoutMs)
    {
        if (_pipe == null || !_pipe.IsConnected)
            return null;

        try
        {
            var buffer = new byte[65536];
            var frameBuffer = new List<byte>();
            var startTime = DateTime.Now;
            var readTask = _pipe.ReadAsync(buffer, 0, buffer.Length);
            
            while ((DateTime.Now - startTime).TotalMilliseconds < timeoutMs)
            {
                // Check if read completed
                if (readTask.IsCompleted)
                {
                    var bytesRead = readTask.Result;
                    if (bytesRead > 0)
                    {
                        for (int i = 0; i < bytesRead; i++)
                        {
                            frameBuffer.Add(buffer[i]);
                        }
                        
                        // Check if we have complete frame
                        var frameStr = Encoding.UTF8.GetString(frameBuffer.ToArray());
                        var startIdx = frameStr.IndexOf(FrameDelim);
                        var endIdx = frameStr.LastIndexOf(FrameDelim);
                        
                        if (startIdx >= 0 && endIdx > startIdx)
                        {
                            var frameContent = frameStr.Substring(startIdx + 1, endIdx - startIdx - 1);
                            return ParseFrame(frameContent);
                        }
                    }
                    
                    // Start next read
                    readTask = _pipe.ReadAsync(buffer, 0, buffer.Length);
                }
                
                await Task.Delay(50);
            }
            
            return null;
        }
        catch { return null; }
    }

    private DuckPipeMessage ParseFrame(string frameContent)
    {
        var message = new DuckPipeMessage();
        
        // Split by FIELD_DELIM
        var parts = frameContent.Split(FieldDelim);
        
        if (parts.Length >= 1)
            message.Type = parts[0];
        if (parts.Length >= 2)
            message.ProfileId = UnescapeField(parts[1]);
        if (parts.Length >= 3)
            message.Data = UnescapeField(parts[2]);
        
        // Parse JSON data if present
        if (!string.IsNullOrEmpty(message.Data))
        {
            try
            {
                var json = JsonSerializer.Deserialize<JsonElement>(message.Data);
                
                // Check for CDP_READY fields
                if (json.TryGetProperty("cdpUrl", out var cdpUrl))
                    message.CdpUrl = cdpUrl.GetString();
                if (json.TryGetProperty("sessionId", out var sessionId))
                    message.SessionId = sessionId.GetString();
                if (json.TryGetProperty("port", out var port))
                    message.CdpPort = port.GetInt32();
                if (json.TryGetProperty("cdpPort", out var cdpPort))
                    message.CdpPort = cdpPort.GetInt32();
            }
            catch { }
        }
        
        return message;
    }

    private static string EscapeField(string s)
    {
        var sb = new StringBuilder();
        foreach (char c in s)
        {
            if (c == FrameDelim || c == FieldDelim || c == '\\')
                sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }

    private static string UnescapeField(string s)
    {
        var sb = new StringBuilder();
        for (int i = 0; i < s.Length; i++)
        {
            if (s[i] == '\\' && i + 1 < s.Length)
            {
                sb.Append(s[i + 1]);
                i++;
            }
            else
            {
                sb.Append(s[i]);
            }
        }
        return sb.ToString();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _pipe?.Dispose();
    }
}

public class DuckPipeMessage
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    [JsonPropertyName("profileId")]
    public string? ProfileId { get; set; }

    [JsonPropertyName("profileName")]
    public string? ProfileName { get; set; }

    [JsonPropertyName("status")]
    public string? Status { get; set; }

    [JsonPropertyName("cdpUrl")]
    public string? CdpUrl { get; set; }

    [JsonPropertyName("cdpPort")]
    public int? CdpPort { get; set; }

    [JsonPropertyName("sessionId")]
    public string? SessionId { get; set; }

    [JsonPropertyName("data")]
    public string? Data { get; set; }
}

[JsonSerializable(typeof(DuckPipeMessage))]
[JsonSerializable(typeof(DuckBrowserConfig))]
[JsonSerializable(typeof(DuckProfileConfig))]
[JsonSerializable(typeof(DuckSystemConfig))]
[JsonSerializable(typeof(DuckFingerprintConfig))]
[JsonSerializable(typeof(DuckNetworkConfig))]
[JsonSerializable(typeof(DuckLocationConfig))]
[JsonSerializable(typeof(DuckSecurityConfig))]
[JsonSerializable(typeof(DuckFileSystemConfig))]
[JsonSerializable(typeof(DuckResourceLimitsConfig))]
[JsonSerializable(typeof(JsonElement))]
internal partial class DuckPipeMessageContext : JsonSerializerContext { }
