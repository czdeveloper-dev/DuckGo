using System.Collections.Concurrent;

namespace DuckGo.Services;

/// <summary>
/// Singleton that serialises browser downloads across all profiles.
/// Only one download per (browserType, browserVersion) at a time.
/// If multiple profiles request the same browser+version concurrently,
/// they all share the same underlying download and receive the same progress callbacks.
///
/// Workflow per download session:
///   1. Show toast (locked) — all waiting profiles show the same toast
///   2. Download the .zip
///   3. Verify SHA256 of the .zip against the template API value
///      → mismatch: delete .zip, report error to all waiting profiles, clean up
///      → match: continue
///   4. Extract: if zip root contains exactly one folder, flatten it (move contents out)
///   5. Validate browser executable exists
///   6. Write InstalledBrowser record
///   7. Notify all waiting profiles — each profile then launches its own browser
/// </summary>
public class DownloadCoordinator : IDisposable
{
    private static readonly Lazy<DownloadCoordinator> _instance = new(() => new DownloadCoordinator());
    public static DownloadCoordinator Instance => _instance.Value;

    // key = $"{browserType}|{browserVersion}"
    private readonly ConcurrentDictionary<string, DownloadSession> _sessions = new();
    private readonly ConcurrentDictionary<int, SessionWaiter> _waiters = new();
    private int _nextWaiterId = 0;

    public event EventHandler<DownloadCoordinatorEventArgs>? StateChanged;

    private DownloadCoordinator() { }

    /// <summary>
    /// Returns immediately: null if no active download for this key,
    /// a SessionWaiter if this profile needs to wait for an in-flight download.
    /// </summary>
    public SessionWaiter? TryJoin(string browserType, string browserVersion, int profileId)
    {
        var key = MakeKey(browserType, browserVersion);

        // Fast path: no active session
        if (!_sessions.TryGetValue(key, out var session))
            return null;

        lock (session.Lock)
        {
            switch (session.State)
            {
                case SessionState.Downloading:
                case SessionState.Extracting:
                case SessionState.Verifying:
                    var waiter = new SessionWaiter
                    {
                        Id = Interlocked.Increment(ref _nextWaiterId),
                        ProfileId = profileId,
                        BrowserType = browserType,
                        BrowserVersion = browserVersion,
                        Key = key,
                        Session = session
                    };
                    _waiters[waiter.Id] = waiter;
                    return waiter;

                case SessionState.Success:
                    // Download already done — no need to wait
                    return null;

                case SessionState.Failed:
                case SessionState.Cancelled:
                    // Old session is done (in error/cancelled state) — let caller start fresh
                    return null;
            }
        }
        return null;
    }

    /// <summary>
    /// Creates and starts a new download session. Only called when no active session exists.
    /// </summary>
    public DownloadSession StartSession(string browserType, string browserVersion, int initiatingProfileId)
    {
        var key = MakeKey(browserType, browserVersion);
        var session = new DownloadSession(browserType, browserVersion, initiatingProfileId);

        // Replace any stale session for this key
        _sessions[key] = session;
        return session;
    }

    /// <summary>
    /// Called by each profile that was waiting on a session once the session completes (success or fail).
    /// </summary>
    public void RemoveWaiter(int waiterId)
    {
        _waiters.TryRemove(waiterId, out _);
    }

    /// <summary>
    /// Fires when a session state changes — used to update toast / status.
    /// </summary>
    public void EmitStateChanged(DownloadSession session, int? forProfileId = null)
    {
        StateChanged?.Invoke(this, new DownloadCoordinatorEventArgs(session, forProfileId));
    }

    public static string MakeKey(string browserType, string browserVersion)
        => $"{browserType?.Trim()?.ToLowerInvariant()}|{browserVersion?.Trim() ?? ""}";

    /// <summary>
    /// Returns profile IDs that are waiting for a specific session (excluding the initiator).
    /// </summary>
    public IEnumerable<int> TryGetWaitingProfileIds(int excludeProfileId, string key)
    {
        if (!_sessions.TryGetValue(key, out var session)) yield break;
        lock (session.Lock)
        {
            foreach (var id in session.WaitingProfileIds)
                if (id != excludeProfileId) yield return id;
        }
    }

    public void Dispose()
    {
        foreach (var s in _sessions.Values)
            s.Dispose();
        _sessions.Clear();
        _waiters.Clear();
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

public enum SessionState
{
    Downloading,
    Extracting,
    Verifying,
    Success,
    Failed,
    Cancelled
}

public class DownloadSession : IDisposable
{
    public string BrowserType { get; }
    public string BrowserVersion { get; }
    public int InitiatingProfileId { get; }
    public SessionState State { get; private set; } = SessionState.Downloading;
    public string? ZipPath { get; set; }
    public string? ExtractPath { get; set; }
    public string? ExecutablePath { get; set; }
    public string? ErrorMessage { get; private set; }
    public DateTime StartedAt { get; } = DateTime.UtcNow;

    private readonly object _lock = new();
    private readonly List<int> _waitingProfileIds = new();

    public object Lock => _lock;
    public IReadOnlyList<int> WaitingProfileIds => _waitingProfileIds;

    public DownloadSession(string browserType, string browserVersion, int initiatingProfileId)
    {
        BrowserType = browserType;
        BrowserVersion = browserVersion;
        InitiatingProfileId = initiatingProfileId;
    }

    public void SetState(SessionState state, string? errorMessage = null)
    {
        lock (_lock)
        {
            State = state;
            if (errorMessage != null) ErrorMessage = errorMessage;
        }
    }

    public void AddWaitingProfile(int profileId)
    {
        lock (_lock)
        {
            if (!_waitingProfileIds.Contains(profileId))
                _waitingProfileIds.Add(profileId);
        }
    }

    public IEnumerable<int> GetAllProfileIds()
    {
        lock (_lock)
        {
            var ids = new List<int> { InitiatingProfileId };
            ids.AddRange(_waitingProfileIds);
            return ids;
        }
    }

    public void Dispose() { }
}

public class SessionWaiter
{
    public int Id { get; set; }
    public int ProfileId { get; set; }
    public string BrowserType { get; set; } = "";
    public string BrowserVersion { get; set; } = "";
    public string Key { get; set; } = "";
    public DownloadSession Session { get; set; } = null!;
}

public class DownloadCoordinatorEventArgs : EventArgs
{
    public DownloadSession Session { get; }
    public int? ForProfileId { get; }

    public DownloadCoordinatorEventArgs(DownloadSession session, int? forProfileId = null)
    {
        Session = session;
        ForProfileId = forProfileId;
    }
}
