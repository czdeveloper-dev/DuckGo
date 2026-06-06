namespace DuckGo.Validation;

public interface IValidator
{
    string[] SupportedActions { get; }
    ValidationResult Validate(string action, System.Text.Json.JsonElement? payload);
}
