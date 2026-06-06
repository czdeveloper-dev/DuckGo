namespace DuckGo.Validation;

public class ValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public Dictionary<string, string> Errors { get; } = new();

    public static ValidationResult Ok() => new();

    public ValidationResult WithError(string field, string message)
    {
        Errors[field] = message;
        return this;
    }
}

public class ValidationException : Exception
{
    public Dictionary<string, string> Errors { get; }
    public ValidationException(Dictionary<string, string> errors)
        : base("Validation failed: " + string.Join("; ", errors.Values))
    {
        Errors = errors;
    }
}
