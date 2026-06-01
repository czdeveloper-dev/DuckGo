namespace DuckGo.Extensions;

public static class StringExtensions
{
    public static bool IsNullOrWhiteSpace(this string? s) => string.IsNullOrWhiteSpace(s);

    public static string Truncate(this string s, int maxLength)
    {
        if (string.IsNullOrEmpty(s)) return s;
        return s.Length <= maxLength ? s : s[..maxLength] + "...";
    }

    public static string Slugify(this string s)
    {
        s = s.Trim().ToLowerInvariant();
        s = System.Text.RegularExpressions.Regex.Replace(s, @"[^\w\s-]", "");
        s = System.Text.RegularExpressions.Regex.Replace(s, @"[-\s]+", "-");
        return s.Trim('-');
    }
}
