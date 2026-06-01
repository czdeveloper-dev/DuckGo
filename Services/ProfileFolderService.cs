using System.IO;

namespace DuckGo.Services;

public class ProfileFolderService
{
    private readonly string _profilesDir;

    public ProfileFolderService()
    {
        _profilesDir = AppConfig.ProfilesDir;
        Directory.CreateDirectory(_profilesDir);
    }

    public string CreateProfileFolder(int profileId)
    {
        var folder = Path.Combine(_profilesDir, profileId.ToString());
        Directory.CreateDirectory(folder);
        Directory.CreateDirectory(Path.Combine(folder, "downloads"));
        Directory.CreateDirectory(Path.Combine(folder, "extensions"));
        return folder;
    }

    public void DeleteProfileFolder(int profileId)
    {
        var folder = Path.Combine(_profilesDir, profileId.ToString());
        if (Directory.Exists(folder))
            Directory.Delete(folder, recursive: true);
    }

    public string GetProfileFolder(int profileId)
        => Path.Combine(_profilesDir, profileId.ToString());

    public void SaveConfigJson(int profileId, string configJson)
    {
        var folder = Path.Combine(_profilesDir, profileId.ToString());
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "config.json"), configJson);
    }

    public void SaveBookmarks(int profileId, string bookmarksJson)
    {
        var folder = Path.Combine(_profilesDir, profileId.ToString());
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "bookmarks.json"), bookmarksJson);
    }

    public void SaveState(int profileId, string stateJson)
    {
        var folder = Path.Combine(_profilesDir, profileId.ToString());
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, "state.json"), stateJson);
    }
}
