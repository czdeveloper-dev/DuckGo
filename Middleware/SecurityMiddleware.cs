using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Text.Json;

namespace DuckGo.Middleware;

public class SecurityMiddleware
{
    // A basic regex pattern to detect common SQL injection attempts
    private static readonly Regex SqlInjectionPattern = new Regex(
        @"(?i)(;\s*(?:DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b)|(--\s)|(\b(?:UNION\s+ALL|UNION|SELECT|INSERT|UPDATE|DELETE)\b.*\b(?:FROM|INTO|SET)\b)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public async Task<(bool IsValid, string? ErrorMessage)> ValidateRequestAsync(string action, JsonElement? payload)
    {
        // 1. Validate payload structure if necessary
        // 2. Prevent SQL injection strings in the payload values
        if (payload.HasValue)
        {
            var rawText = payload.Value.GetRawText();
            if (SqlInjectionPattern.IsMatch(rawText))
            {
                return (false, "Potential security threat detected in payload.");
            }
        }

        // Additional security checks can be added here
        
        await Task.CompletedTask;
        return (true, null);
    }
}
