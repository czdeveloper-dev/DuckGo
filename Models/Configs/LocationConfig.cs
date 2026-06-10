namespace DuckGo.Models.Configs;

public class LocationConfig
{
    public string Mode { get; set; } = "noise";
    public string Access { get; set; } = "block";
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int? Accuracy { get; set; }

    public static LocationConfig Default => new();
}
