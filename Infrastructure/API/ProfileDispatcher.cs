using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bogus;

namespace DuckGo.Infrastructure.API
{
    public class ProfileDispatcher : IDispatcher
    {
        private readonly Services.ProfileService _service;
        private readonly Services.FingerprintService _fingerprintService;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

        public string Domain => "profile";

        public ProfileDispatcher(Services.ProfileService service, Services.FingerprintService fingerprintService)
        {
            _service = service;
            _fingerprintService = fingerprintService;
        }

        public bool CanHandle(string action) => action.StartsWith("profile.");

        public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
        {
            return action switch
            {
                "profile.list" => await ListAsync(payload),
                "profile.get" => await GetAsync(payload),
                "profile.create" => await CreateAsync(payload),
                "profile.update" => await UpdateAsync(payload),
                "profile.delete" => await DeleteAsync(payload),
                "profile.duplicate" => await DuplicateAsync(payload),
                "profile.getFingerprintTemplate" => await GetFingerprintTemplateAsync(),
                "profile.generateFingerprint" => await GenerateFingerprintAsync(payload),
                "profile.bulkCreate" => await BulkCreateAsync(payload),
                _ => (false, $"Unknown action: {action}", null)
            };
        }

        private async Task<(bool, string?, JsonElement?)> ListAsync(JsonElement? payload)
        {
            string? search = null, browserType = null;
            int? id = null, groupId = null;
            List<int>? tagIds = null;

            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("search", out var s)) search = s.GetString();
                if (p.TryGetProperty("id", out var i)) id = i.ValueKind == JsonValueKind.Null ? null : i.GetInt32();
                if (p.TryGetProperty("groupId", out var g)) groupId = g.ValueKind == JsonValueKind.Null ? null : g.GetInt32();
                if (p.TryGetProperty("browserType", out var b)) browserType = b.GetString();
                if (p.TryGetProperty("tagIds", out var t) && t.ValueKind == JsonValueKind.Array)
                    tagIds = t.EnumerateArray().Select(e => e.GetInt32()).ToList();
            }

            var result = await _service.GetProfilesAsync(search, id, groupId, tagIds, browserType);
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> GetAsync(JsonElement? payload)
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            var profile = await _service.GetProfileAsync(id.Value);
            return profile != null ? (true, null, WrapInElement(profile)) : (false, "Profile not found", null);
        }

        private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
        {
            var req = ParsePayload<Models.DTOs.ProfileCreateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result = await _service.CreateProfileAsync(req);
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
        {
            var req = ParsePayload<Models.DTOs.ProfileUpdateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            var result = await _service.UpdateProfileAsync(req);
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> DeleteAsync(JsonElement? payload)
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            await _service.DeleteProfileAsync(id.Value);
            return (true, null, null);
        }

        private async Task<(bool, string?, JsonElement?)> DuplicateAsync(JsonElement? payload)
        {
            var id   = payload?.GetProperty("id").GetInt32();
            var name = payload?.GetProperty("name").GetString() ?? "Copy";
            if (!id.HasValue) return (false, "Missing id", null);
            var result = await _service.DuplicateProfileAsync(id.Value, name);
            return (true, null, WrapInElement(result));
        }

        private static readonly Faker _bulkFaker = new();
        
        private static string GenerateRandomName() {
            var firstName = _bulkFaker.Name.FirstName();
            var lastName = _bulkFaker.Name.LastName();
            var suffix = _bulkFaker.Random.Number(10, 9999);
            return $"{firstName} {lastName} {suffix}";
        }
        
        private async Task<(bool, string?, JsonElement?)> BulkCreateAsync(JsonElement? payload)
        {
            var req = ParsePayload<Models.DTOs.BulkCreateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);

            var count = Math.Clamp(req.Quantity ?? 1, 1, 500);
            var results = new List<Models.DTOs.ProfileListItem>();

            await _fingerprintService.GetRandomLocationAsync("", useOffset: true);

            for (int i = 0; i < count; i++)
            {
                string? nameForThis = null;
                if (!string.IsNullOrWhiteSpace(req.Prefix))
                    nameForThis = count == 1 ? req.Prefix : $"{req.Prefix} {i + 1}";
                else
                    nameForThis = GenerateRandomName();

                var createReq = new Models.DTOs.ProfileCreateRequest(
                    Name: nameForThis ?? "",
                    GroupId: req.GroupId,
                    TagIds: req.TagIds,
                    ProxyId: req.ProxyId,
                    BrowserType: req.BrowserType,
                    ProfileData: null,
                    Notes: req.Notes ?? "",
                    StartUrl: null,
                    CookiesData: null,
                    CookiesFileName: null,
                    Cookies: null,
                    Fingerprint: req.Fingerprint
                );

                var result = await _service.CreateProfileAsync(createReq);
                results.Add(result);
            }

            return (true, null, WrapInElement(results));
        }

        private async Task<(bool, string?, JsonElement?)> GetFingerprintTemplateAsync()
        {
            try
            {
                DispatcherLog("FP_START", "GetFingerprintTemplateAsync called");
                var tmpl = await _fingerprintService.GetTemplatesAsync();
                var json = System.Text.Json.JsonSerializer.Serialize(tmpl);
                DispatcherLog("FP_OK", $"Templates: {tmpl.Timezones.Count} TZs, {tmpl.Languages.Count} LGs, {tmpl.OS.Count} OSes, JSON len={json.Length}");
                return (true, null, WrapInElement(tmpl));
            }
            catch (Exception ex)
            {
                DispatcherLog("FP_FAIL", $"Error: {ex.Message}");
                return (false, ex.Message, null);
            }
        }

        private async Task<(bool, string?, JsonElement?)> GenerateFingerprintAsync(JsonElement? payload)
        {
            string? platform = null, browserType = null, osModelName = null;
            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("platform", out var pl)) platform = pl.GetString();
                if (p.TryGetProperty("browser", out var b)) browserType = b.GetString();
                if (p.TryGetProperty("model", out var m)) osModelName = m.GetString();
            }
            var result = await _fingerprintService.GenerateStructuredAsync(platform, browserType, osModelName);
            return (true, null, WrapInElement(result));
        }

        private static JsonElement WrapInElement<T>(T obj)
        {
            var json = JsonSerializer.Serialize(obj, _jsonOptions);
            return JsonDocument.Parse(json).RootElement;
        }

        private static T? ParsePayload<T>(JsonElement? payload) where T : class
        {
            if (!payload.HasValue) return null;
            try
            {
                return JsonSerializer.Deserialize<T>(payload.Value.GetRawText(),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            }
            catch { return null; }
        }

        private static void DispatcherLog(string evt, string msg)
        {
            try
            {
                var log = new
                {
                    sessionId = "971020",
                    ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    evt,
                    msg,
                    src = "ProfileDispatcher"
                };
                var path = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "debug-971020.log");
                File.AppendAllText(path, System.Text.Json.JsonSerializer.Serialize(log) + "\n");
            }
            catch { }
        }
    }

    internal class DoublePrecisionConverter : JsonConverter<double>
    {
        private const int MaxDecimalPlaces = 14;

        public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
            => reader.GetDouble();

        public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                writer.WriteNumberValue(0);
                return;
            }

            var rounded = Math.Round(value, MaxDecimalPlaces);
            writer.WriteNumberValue(rounded);
        }
    }
}
