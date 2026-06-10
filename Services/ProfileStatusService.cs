using System.Collections.Concurrent;

namespace DuckGo.Services;

public class ProfileStatusService
{
    private readonly Action<Models.DTOs.ProfileMessageUpdate> _onMessageUpdate;
    private readonly Action<int, string> _onPush;

    private static readonly ConcurrentDictionary<int, ProfileRuntimeState> _runtimeStates = new();

    public ProfileStatusService(
        Action<Models.DTOs.ProfileMessageUpdate> onMessageUpdate,
        Action<int, string> onPush)
    {
        _onMessageUpdate = onMessageUpdate;
        _onPush = onPush;
    }

    public static string GetStatus(int profileId) =>
        _runtimeStates.TryGetValue(profileId, out var s) ? s.Status : "ready";

    public static string GetMessage(int profileId) =>
        _runtimeStates.TryGetValue(profileId, out var s) ? s.Message : "";

    public void UpdateMessage(int profileId, string message)
    {
        var state = _runtimeStates.AddOrUpdate(profileId,
            new ProfileRuntimeState { Status = "ready", Message = message },
            (_, s) => { s.Message = message; return s; });

        _onMessageUpdate(new Models.DTOs.ProfileMessageUpdate { ProfileId = profileId, Message = message, Status = state.Status });
        _onPush(profileId, message);
    }

    public void UpdateStatus(int profileId, string status, string? message = null)
    {
        var state = _runtimeStates.AddOrUpdate(profileId,
            new ProfileRuntimeState { Status = status, Message = message ?? "" },
            (_, s) => { s.Status = status; if (message != null) s.Message = message; return s; });

        _onMessageUpdate(new Models.DTOs.ProfileMessageUpdate
        {
            ProfileId = profileId,
            Message = message ?? state.Message,
            Status = status
        });
        _onPush(profileId, message ?? state.Message);
    }

    public static void Clear(int profileId) => _runtimeStates.TryRemove(profileId, out _);

    private class ProfileRuntimeState
    {
        public string Status { get; set; } = "ready";
        public string Message { get; set; } = "";
    }
}
