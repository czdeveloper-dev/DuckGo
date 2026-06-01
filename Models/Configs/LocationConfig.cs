namespace DuckGo.Models.Configs;

public class LocationConfig
{
    public string Mode { get; set; } = "Noise";
    public double Latitude { get; set; } = 40.7128;
    public double Longitude { get; set; } = -74.0060;
    public int Accuracy { get; set; } = 100;

    public static LocationConfig Default => new();
}
