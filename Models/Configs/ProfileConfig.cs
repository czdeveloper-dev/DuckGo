namespace DuckGo.Models.Configs;

public class ProfileDataConfig
{
    public SystemConfig? System { get; set; }
    public FingerprintConfig? Fingerprint { get; set; }
    public NetworkConfig? Network { get; set; }
    public SecurityConfig? Security { get; set; }
    public LocationConfig? Location { get; set; }

    public static ProfileDataConfig Default => new()
    {
        System = SystemConfig.Default,
        Fingerprint = FingerprintConfig.Default,
        Network = new NetworkConfig(),
        Security = new SecurityConfig(),
        Location = new LocationConfig { Mode = "Noise", Latitude = 40.7128, Longitude = -74.0060, Accuracy = 100 }
    };
}
