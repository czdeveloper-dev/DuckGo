using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bogus;
using DuckGo.Models.DTOs;

namespace DuckGo.Infrastructure.API
{
    public class ProfileDispatcher : IDispatcher
    {
        private readonly Services.ProfileService _service;
        private readonly Services.FingerprintService _fingerprintService;
        private readonly Services.ProfileStatusService _statusService;
        private readonly Services.ProxyService _proxyService;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

        public string Domain => "profile";

        public ProfileDispatcher(
            Services.ProfileService service,
            Services.FingerprintService fingerprintService,
            Services.ProfileStatusService statusService,
            Services.ProxyService proxyService)
        {
            _service = service;
            _fingerprintService = fingerprintService;
            _statusService = statusService;
            _proxyService = proxyService;
        }

        public bool CanHandle(string action) => action.StartsWith("profile.");

        public async Task<(bool Success, string? Error, JsonElement? Data)> DispatchAsync(string action, JsonElement? payload)
        {
            try
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
                    "profile.bulkDelete" => await BulkDeleteAsync(payload),
                    "profile.bulkUpdateBrowserVersion" => await BulkUpdateBrowserVersionAsync(payload),
                    "profile.detectScreen" => await DetectScreenAsync(),
                    "profile.regenerateFingerprint" => await RegenerateFingerprintAsync(payload),
                    "profile.checkProxy" => await CheckProxyAsync(payload),
                    _ => (false, $"Unknown action: {action}", null)
                };
            }
            catch (Exception ex)
            {
                return (false, ex.Message, null);
            }
        }

        private async Task<(bool, string?, JsonElement?)> ListAsync(JsonElement? payload)
        {
            string? search = null, browserType = null, status = null;
            string? idStr = null;
            int? groupId = null;
            List<int>? tagIds = null;

            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("search", out var s)) search = s.GetString();
                if (p.TryGetProperty("id", out var i))
                {
                    if (i.ValueKind == JsonValueKind.Number) idStr = i.GetInt32().ToString();
                    else if (i.ValueKind == JsonValueKind.String) idStr = i.GetString();
                }
                if (p.TryGetProperty("groupId", out var g)) groupId = g.ValueKind == JsonValueKind.Null ? null : g.GetInt32();
                if (p.TryGetProperty("browserType", out var b)) browserType = b.GetString();
                if (p.TryGetProperty("status", out var st)) status = st.GetString();
                if (p.TryGetProperty("tagIds", out var t) && t.ValueKind == JsonValueKind.Array)
                    tagIds = t.EnumerateArray().Select(e => e.GetInt32()).ToList();
            }

            var result = await _service.GetProfilesAsync(search, idStr, groupId, tagIds, browserType, status);
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> GetAsync(JsonElement? payload)
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);
            var profile = await _service.GetProfileAsync(id.Value);
            if (profile == null) return (false, "Profile not found", null);
            
            return (true, null, WrapInElement(profile));
        }

        private async Task<(bool, string?, JsonElement?)> CreateAsync(JsonElement? payload)
        {
            var req = ParsePayload<Models.DTOs.ProfileCreateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            
            Console.WriteLine($"[ProfileDispatcher.CreateAsync] Incoming fingerprint: {System.Text.Json.JsonSerializer.Serialize(req.Fingerprint)}");
            
            var result = await _service.CreateProfileAsync(req);
            
            // Debug: Log what CreateProfileAsync returns
            if (result is ProfileDetailItem detail)
            {
                Console.WriteLine($"[ProfileDispatcher.CreateAsync] Created profile {result.Id}, ProfileData length={detail.ProfileData?.Length ?? 0}");
                Console.WriteLine($"[ProfileDispatcher.CreateAsync] ProfileData preview: {detail.ProfileData?.Substring(0, Math.Min(300, detail.ProfileData?.Length ?? 0))}");
            }
            
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> UpdateAsync(JsonElement? payload)
        {
            var req = ParsePayload<Models.DTOs.ProfileUpdateRequest>(payload);
            if (req == null) return (false, "Invalid payload", null);
            
            Console.WriteLine($"[ProfileDispatcher.UpdateAsync] ProfileId={req.Id}, ProfileData length={req.ProfileData?.Length ?? 0}");
            Console.WriteLine($"[ProfileDispatcher.UpdateAsync] ProfileData preview: {req.ProfileData?.Substring(0, Math.Min(300, req.ProfileData?.Length ?? 0))}");
            
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

        private async Task<(bool, string?, JsonElement?)> BulkDeleteAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);

            List<int> ids;
            try
            {
                ids = payload.Value.EnumerateArray().Select(e => e.GetInt32()).ToList();
            }
            catch
            {
                return (false, "Invalid profile ids", null);
            }

            var deleted = 0;
            foreach (var id in ids)
            {
                try
                {
                    await _service.DeleteProfileAsync(id);
                    deleted++;
                }
                catch { }
            }

            return (true, null, WrapInElement(new { total = ids.Count, deleted }));
        }

        private Task<(bool, string?, JsonElement?)> DetectScreenAsync()
        {
            var info = _service.DetectScreen();
            return Task.FromResult<(bool, string?, JsonElement?)>((true, null, WrapInElement(info)));
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
            string? platform = null, browserType = null, osModelName = null, browserVersion = null;
            if (payload.HasValue)
            {
                var p = payload.Value;
                if (p.TryGetProperty("platform", out var pl)) platform = pl.GetString();
                if (p.TryGetProperty("browser", out var b)) browserType = b.GetString();
                if (p.TryGetProperty("model", out var m)) osModelName = m.GetString();
                if (p.TryGetProperty("version", out var v)) browserVersion = v.GetString();
            }
            var result = await _fingerprintService.GenerateStructuredAsync(platform, browserType, osModelName, browserVersion);
            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> RegenerateFingerprintAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);

            var ids = new List<int>();

            if (payload.Value.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in payload.Value.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.Number)
                        ids.Add(item.GetInt32());
                }
            }
            else if (payload.Value.TryGetProperty("id", out var idProp))
            {
                if (idProp.ValueKind == JsonValueKind.Number)
                    ids.Add(idProp.GetInt32());
            }

            if (ids.Count == 0) return (false, "No profile ids provided", null);

            var results = new List<Services.ProfileService.RegenerateFingerprintResult>();

            foreach (var id in ids)
            {
                try
                {
                    _statusService.UpdateMessage(id, "Generating fingerprint...");

                    var result = await _service.RegenerateFingerprintAsync(id);

                    string Truncate(string? s, int len = 6) =>
                        string.IsNullOrEmpty(s) ? "(empty)" : s.Length <= len ? s : s[..len];

                    var msg = $"Fingerprint regenerated - "
                        + $"Canvas: {Truncate(result.CanvasSeed)}, "
                        + $"Audio: {Truncate(result.AudioSeed)}, "
                        + $"Font: {Truncate(result.FontSeed)}, "
                        + $"WebGL: {Truncate(result.WebGLSeed)}";

                    _statusService.UpdateMessage(id, msg);
                    results.Add(result);
                }
                catch (InvalidOperationException ex)
                {
                    _statusService.UpdateMessage(id, $"Error: {ex.Message}");
                }
                catch (Exception ex)
                {
                    _statusService.UpdateMessage(id, $"Error: {ex.Message}");
                }
            }

            return (true, null, WrapInElement(new
            {
                total = ids.Count,
                success = results.Count,
                results
            }));
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

        private async Task<(bool, string?, JsonElement?)> CheckProxyAsync(JsonElement? payload)
        {
            var id = payload?.GetProperty("id").GetInt32();
            if (!id.HasValue) return (false, "Missing id", null);

            var profile = await _service.GetProfileAsync(id.Value);
            if (profile == null) return (false, "Profile not found", null);

            DuckGo.Services.ProxyCheckResult result;

            if (profile.ProxyId.HasValue)
            {
                result = await _proxyService.CheckProxyAsync(profile.ProxyId.Value);
            }
            else if (!string.IsNullOrEmpty(profile.ProfileData) && profile.ProfileData.Contains("\"Network\""))
            {
                try {
                    var doc = JsonDocument.Parse(profile.ProfileData);
                    if (doc.RootElement.TryGetProperty("Network", out var net) &&
                        net.TryGetProperty("Proxy", out var proxy) &&
                        proxy.TryGetProperty("Mode", out var mode) && mode.GetString() == "custom")
                    {
                        var type = proxy.TryGetProperty("Type", out var t) ? t.GetString() ?? "http" : "http";
                        var host = proxy.TryGetProperty("Host", out var h) ? h.GetString() ?? "" : "";
                        
                        int port = 0;
                        if (proxy.TryGetProperty("Port", out var pt))
                        {
                            if (pt.ValueKind == JsonValueKind.Number) port = pt.GetInt32();
                            else if (pt.ValueKind == JsonValueKind.String && int.TryParse(pt.GetString(), out int p)) port = p;
                        }
                        
                        var username = proxy.TryGetProperty("Username", out var u) ? u.GetString() : "";
                        var password = proxy.TryGetProperty("Password", out var pass) ? pass.GetString() : "";

                        if (string.IsNullOrEmpty(host)) return (false, "Proxy host is empty", null);

                        result = await _proxyService.CheckProxyAsync(new Models.DTOs.ProxyCheckRequest(type, host, port, username, password));
                    }
                    else
                    {
                        return (false, "Profile has no proxy configured", null);
                    }
                } catch {
                    return (false, "Invalid proxy configuration", null);
                }
            }
            else
            {
                return (false, "Profile has no proxy configured", null);
            }

            return (true, null, WrapInElement(result));
        }

        private async Task<(bool, string?, JsonElement?)> BulkUpdateBrowserVersionAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Invalid payload", null);
            var p = payload.Value;

            if (!p.TryGetProperty("ids", out var idsProp) || idsProp.ValueKind != JsonValueKind.Array)
                return (false, "Invalid profile ids", null);

            var ids = idsProp.EnumerateArray().Select(e => e.GetInt32()).ToList();
            if (ids.Count == 0) return (false, "No profile ids provided", null);

            var version = p.TryGetProperty("version", out var vProp) ? vProp.GetString() : null;
            if (string.IsNullOrEmpty(version)) return (false, "Invalid version", null);

            var autoUpdateUA = p.TryGetProperty("autoUpdateUA", out var aProp) && aProp.ValueKind == JsonValueKind.True;

            int updated = 0;
            foreach (var id in ids)
            {
                try
                {
                    await _service.UpdateProfileBrowserVersionAsync(id, version, autoUpdateUA);
                    updated++;
                }
                catch (Exception ex)
                {
                    DispatcherLog("UPDATE_VERSION_ERR", $"Error updating {id}: {ex.Message}");
                }
            }

            return (true, null, WrapInElement(new { Updated = updated }));
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