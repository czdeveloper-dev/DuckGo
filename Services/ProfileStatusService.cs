using DuckGo.Data;
using DuckGo.Data.Repositories;

namespace DuckGo.Services;

public class ProfileStatusService
{
    private readonly IProfileRepository _profileRepo;
    private readonly Action<Models.DTOs.ProfileMessageUpdate> _onMessageUpdate;
    private readonly Action<string, object> _onPush;

    public ProfileStatusService(
        IProfileRepository profileRepo,
        Action<Models.DTOs.ProfileMessageUpdate> onMessageUpdate,
        Action<string, object> onPush)
    {
        _profileRepo = profileRepo;
        _onMessageUpdate = onMessageUpdate;
        _onPush = onPush;
    }

    public async Task UpdateMessageAsync(int profileId, string message)
    {
        await _profileRepo.UpdateMessageAsync(profileId, message);
        _onMessageUpdate(new Models.DTOs.ProfileMessageUpdate { ProfileId = profileId, Message = message });
        _onPush("profile.message", new { profileId, message });
    }

    public async Task UpdateStatusAsync(int profileId, string status, string? message = null)
    {
        await _profileRepo.UpdateStatusAsync(profileId, status);
        _onMessageUpdate(new Models.DTOs.ProfileMessageUpdate
        {
            ProfileId = profileId,
            Message = message ?? "",
            Status = status
        });
        _onPush("profile.status", new { profileId, status, message = message ?? "" });
    }
}
