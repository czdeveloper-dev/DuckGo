using System.Text.Json;

namespace DuckGo.Pipes;

public class PipeMessage
{
    public string Type { get; set; } = "";
    public string? ProfileId { get; set; }
    public object? Data { get; set; }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public string Serialize() => JsonSerializer.Serialize(this, JsonOptions);

    public static PipeMessage? Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<PipeMessage>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }
}
