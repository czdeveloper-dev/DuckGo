using System.IO;
using System.Text.Json;
using DuckGo.Models.Configs;
using DuckGo.Models.Entities;

namespace DuckGo.Services;

public class ConfigBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public string BuildConfigJson(Profile profile)
    {
        var cfg = ParseProfileData(profile.ProfileData);
        var msg = new
        {
            type = "CONFIG",
            Profile = new
            {
                ProfileID = profile.Id.ToString(),
                ProfileName = profile.Name,
                StartURL = ""
            },
            System = cfg.System,
            Fingerprint = cfg.Fingerprint,
            Location = cfg.Location,
            Network = cfg.Network,
            Security = cfg.Security
        };
        return JsonSerializer.Serialize(msg, JsonOptions);
    }

    public string BuildFsConfigJson(Profile profile)
    {
        var msg = new
        {
            DownloadLocation = Path.Combine(AppConfig.ProfilesDir, profile.Id.ToString(), "downloads")
        };
        return JsonSerializer.Serialize(msg, JsonOptions);
    }

    public string BuildResourceLimitsJson()
    {
        var msg = new
        {
            MaxMemoryMb = 512,
            TargetMemoryMb = 384,
            MaxCpuPercent = 50,
            ThreadLimit = 8,
            EnableMemoryOptimization = true,
            EnableCpuThrottling = true
        };
        return JsonSerializer.Serialize(msg, JsonOptions);
    }

    public string BuildConnectMessage(Profile profile)
    {
        var msg = new
        {
            type = "CONNECT",
            ProfileId = profile.Id.ToString(),
            ProfileName = profile.Name
        };
        return JsonSerializer.Serialize(msg, JsonOptions);
    }

    private static ProfileDataConfig ParseProfileData(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<ProfileDataConfig>(json, JsonOptions) ?? ProfileDataConfig.Default;
        }
        catch
        {
            return ProfileDataConfig.Default;
        }
    }
}
