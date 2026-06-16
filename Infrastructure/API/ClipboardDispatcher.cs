using System.Text.Json;
using System.Threading.Tasks;

namespace DuckGo.Infrastructure.API;

public class ClipboardDispatcher : IDispatcher
{
    public string Domain => "clipboard";
    public bool CanHandle(string action) => action.StartsWith("clipboard.");

    public Task<(bool, string?, JsonElement?)> DispatchAsync(string action, JsonElement? payload)
    {
        if (action == "clipboard.writeText")
        {
            if (payload.HasValue && payload.Value.TryGetProperty("text", out var textEl))
            {
                var text = textEl.GetString() ?? "";
                var t = new System.Threading.Thread(() => System.Windows.Clipboard.SetText(text));
                t.SetApartmentState(System.Threading.ApartmentState.STA);
                t.Start();
                t.Join();
                return Task.FromResult<(bool, string?, JsonElement?)>((true, null, null));
            }
            return Task.FromResult<(bool, string?, JsonElement?)>((false, "Missing text", null));
        }

        return Task.FromResult<(bool, string?, JsonElement?)>((false, $"Unknown action: {action}", null));
    }
}
