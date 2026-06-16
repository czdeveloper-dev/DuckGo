namespace DuckGo.Models.Configs;

/// <summary>
/// Browser UI mode configuration.
/// </summary>
public class UIConfig
{
    /// <summary>
    /// UI mode: "GUI" (normal window), "HEADLESS" (no window), "HEADLESS_RECORDING" (headless + recording).
    /// </summary>
    public string Mode { get; set; } = "GUI";
    
    /// <summary>Window size configuration.</summary>
    public WindowSizeConfig WindowSize { get; set; } = new();
}

public class WindowSizeConfig
{
    /// <summary>Window/viewport width in pixels.</summary>
    public int? Width { get; set; }
    /// <summary>Window/viewport height in pixels.</summary>
    public int? Height { get; set; }
}
