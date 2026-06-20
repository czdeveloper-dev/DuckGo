namespace DuckGo.Validation;

public class ValidatorFactory
{
    private readonly List<IValidator> _validators = new()
    {
        new ProfileValidator(),
        new ProxyValidator(),
        new ProfileGroupValidator(),
        new ProfileTagValidator(),
    };

    public ValidationResult Validate(string action, System.Text.Json.JsonElement? payload)
    {
        foreach (var v in _validators)
        {
            if (Array.Exists(v.SupportedActions, a => a == action))
            {
                var result = v.Validate(action, payload);
                if (!result.IsValid) return result;
            }
        }
        return ValidationResult.Ok();
    }
}
