using System.IO;
using System.IO.Pipes;
using System.Text;

namespace DuckGo.Pipes;

public class PipeConnection : IDisposable
{
    private NamedPipeClientStream? _pipe;
    private readonly string _pipeName;
    private readonly int _connectTimeoutMs;

    public PipeConnection(string pipeName, int connectTimeoutMs)
    {
        _pipeName = pipeName;
        _connectTimeoutMs = connectTimeoutMs;
    }

    public async Task<bool> ConnectAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _pipe = new NamedPipeClientStream(
                ".",
                _pipeName,
                PipeDirection.InOut,
                PipeOptions.Asynchronous);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(_connectTimeoutMs);

            await _pipe.ConnectAsync(cts.Token);
            return _pipe.IsConnected;
        }
        catch
        {
            return false;
        }
    }

    public async Task<string?> SendReceiveAsync(string message, CancellationToken cancellationToken = default)
    {
        if (_pipe == null || !_pipe.IsConnected) return null;

        var requestBytes = Encoding.UTF8.GetBytes(message + "\n");
        await _pipe.WriteAsync(requestBytes, cancellationToken);

        var buffer = new byte[4096];
        var bytesRead = await _pipe.ReadAsync(buffer, cancellationToken);
        if (bytesRead <= 0) return null;

        return Encoding.UTF8.GetString(buffer, 0, bytesRead).TrimEnd('\0');
    }

    public void Disconnect()
    {
        _pipe?.Dispose();
    }

    public bool IsConnected => _pipe?.IsConnected ?? false;

    public void Dispose()
    {
        _pipe?.Dispose();
    }
}
