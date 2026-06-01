using System.Text.RegularExpressions;
using DuckGo.Models.DTOs;

namespace DuckGo.Validation;

public class ProfileValidator
{
    public ValidationResult Validate(ProfileCreateRequest req)
    {
        var result = new ValidationResult();
        if (string.IsNullOrWhiteSpace(req.Name))
            result.Errors["name"] = "Name is required";
        else if (req.Name.Length > 200)
            result.Errors["name"] = "Name must be 200 characters or less";
        if (req.BrowserType != "Chromium" && req.BrowserType != "Firefox")
            result.Errors["browserType"] = "BrowserType must be Chromium or Firefox";
        return result;
    }

    public ValidationResult Validate(ProfileUpdateRequest req)
    {
        var result = new ValidationResult();
        if (req.Id <= 0) result.Errors["id"] = "Invalid profile ID";
        if (string.IsNullOrWhiteSpace(req.Name))
            result.Errors["name"] = "Name is required";
        else if (req.Name.Length > 200)
            result.Errors["name"] = "Name must be 200 characters or less";
        return result;
    }
}

public class ProxyValidator
{
    public ValidationResult Validate(ProxyCreateRequest req)
    {
        var result = new ValidationResult();
        if (string.IsNullOrWhiteSpace(req.Name))
            result.Errors["name"] = "Name is required";
        if (string.IsNullOrWhiteSpace(req.Host))
            result.Errors["host"] = "Host is required";
        if (req.Port <= 0 || req.Port > 65535)
            result.Errors["port"] = "Port must be between 1 and 65535";
        var validTypes = new[] { "http", "https", "socks4", "socks5" };
        if (!validTypes.Contains(req.Type))
            result.Errors["type"] = "Type must be http, https, socks4, or socks5";
        return result;
    }
}

public class ValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public Dictionary<string, string> Errors { get; } = new();
}
