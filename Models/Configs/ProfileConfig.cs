namespace DuckGo.Models.Configs;

public class ProfileDataConfig
{
    public ProfileMetadataConfig? Profile { get; set; }
    public SystemConfig? System { get; set; }
    public FingerprintConfig? Fingerprint { get; set; }
    public NetworkConfig? Network { get; set; }
    public SecurityConfig? Security { get; set; }
    public LocationConfig? Location { get; set; }
    public UIConfig? UI { get; set; }

    public static ProfileDataConfig Default => new()
    {
        Profile = new ProfileMetadataConfig(),
        System = SystemConfig.Default,
        Fingerprint = FingerprintConfig.Default,
        Network = new NetworkConfig(),
        Security = new SecurityConfig(),
        Location = LocationConfig.Default,
        UI = new UIConfig()
    };
}

public class ProfileMetadataConfig
{
    public string ProfileID { get; set; } = "";
    public string ProfileName { get; set; } = "";
    public string StartURL { get; set; } = "";
}
