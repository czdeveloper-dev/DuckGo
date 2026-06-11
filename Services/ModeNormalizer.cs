namespace DuckGo.Services;

/// <summary>
/// Centralized mode normalization utilities for fingerprint settings.
/// Handles conversion between UI values, storage format, and DuckBrowser config format.
/// 
/// Mode Semantics:
/// - null = Real mode (use browser's real value)
/// - "noise" = Spoof with noise
/// - "random" = Random spoof
/// - "custom" = User-specified value
/// </summary>
public static class ModeNormalizer
{
    /// <summary>
    /// Convert fingerprint config mode value to storage format.
    /// "real" → "real". "random" → "noise" (randomly-generated spoof value from template).
    /// "custom" → "noise" (user explicitly provided custom value → spoof it).
    /// All other values pass through as-is.
    /// DB storage only ever contains: "real", "noise", "default", "block", "disable", null.
    /// </summary>
    public static string? ToFingerprintStorage(string? uiMode)
    {
        if (string.IsNullOrWhiteSpace(uiMode)) return null;
        var normalized = uiMode.Trim().ToLowerInvariant();
        if (normalized == "real") return "real";
        if (normalized == "random") return "noise"; // random in DB means noise with browser-generated value
        if (normalized == "custom") return "noise"; // custom = user-provided value → spoof it
        return normalized;
    }

    /// <summary>
    /// Convert UI value to storage format (generic pass-through).
    /// All values pass through as-is. null/empty → null (Real mode in DB).
    /// </summary>
    public static string? UiToStorage(string? uiMode)
    {
        if (string.IsNullOrWhiteSpace(uiMode)) return null;
        return uiMode.Trim().ToLowerInvariant();
    }

    /// <summary>
    /// Convert storage format to UI display value.
    /// </summary>
    public static string StorageToUi(string? storageMode)
    {
        if (string.IsNullOrWhiteSpace(storageMode)) return "real";
        return storageMode.Trim().ToLowerInvariant();
    }

    /// <summary>
    /// Convert storage format to DuckBrowser config format.
    /// DuckBrowser uses null for Real mode, strings for others.
    /// Storage format is already compatible with DuckBrowser format.
    /// </summary>
    public static string? ToDuckBrowser(string? storageMode)
    {
        // Storage format (null=Real, string=other) is already DuckBrowser format
        return storageMode;
    }

    /// <summary>
    /// Check if a mode represents Real mode (use real browser value).
    /// </summary>
    public static bool IsRealMode(string? mode)
    {
        return string.IsNullOrWhiteSpace(mode);
    }

    /// <summary>
    /// Check if a mode represents a spoof mode (noise, random, custom).
    /// </summary>
    public static bool IsSpoofMode(string? mode)
    {
        return !string.IsNullOrWhiteSpace(mode);
    }

    /// <summary>
    /// Get mode display name for logging/debugging.
    /// </summary>
    public static string GetModeDisplayName(string? mode)
    {
        return IsRealMode(mode) ? "Real" : mode ?? "Unknown";
    }

    /// <summary>
    /// Validate if a mode value is a known/supported mode.
    /// </summary>
    public static bool IsValidMode(string? mode)
    {
        if (string.IsNullOrWhiteSpace(mode)) return true; // null is valid (Real mode)
        
        var normalized = mode.Trim().ToLowerInvariant();
        return normalized is "noise" or "random" or "custom";
    }
}
