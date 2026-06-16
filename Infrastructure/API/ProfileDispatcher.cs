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
                    "profile.copyProxy" => await CopyProxyAsync(payload),
                    "profile.removeProxy" => await RemoveProxyAsync(payload),
                    "profile.importProxies" => await ImportProxiesAsync(payload),
                    "profile.parseFile" => await ParseFileAsync(payload),
                    "profile.exportProfiles" => await ExportProfilesAsync(payload),
                    "profile.importProfiles" => await ImportProfilesAsync(payload),
                    "profile.getResource" => await GetResourceAsync(payload),
                    "profile.updateResource" => await UpdateResourceAsync(payload),
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
                    BrowserVersion: null,
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

        private async Task<(bool, string?, JsonElement?)> CopyProxyAsync(JsonElement? payload)
        {
            if (!payload.HasValue || !payload.Value.TryGetProperty("ids", out var idsEl) || idsEl.ValueKind != JsonValueKind.Array)
                return (false, "Missing 'ids' array", null);

            var ids = idsEl.EnumerateArray().Select(e => e.GetInt32()).ToList();
            var profilesResponse = await _service.GetProfilesAsync();
            var targetProfiles = profilesResponse.Items.Where(p => ids.Contains(p.Id)).ToList();
            var lines = new List<string>();

            foreach (var p in targetProfiles)
            {
                var proxyStrings = new List<string>();
                
                // 1. Proxy from ProxyId (Backend DB)
                if (p.ProxyId.HasValue)
                {
                    var proxyResponse = await _proxyService.GetProxyAsync(p.ProxyId.Value);
                    if (proxyResponse != null)
                    {
                        var str = $"{proxyResponse.Host}:{proxyResponse.Port}";
                        if (!string.IsNullOrEmpty(proxyResponse.Username))
                            str += $":{proxyResponse.Username}";
                        if (!string.IsNullOrEmpty(proxyResponse.Password))
                            str += $":{proxyResponse.Password}";
                        proxyStrings.Add(str);
                    }
                }

                // 2. Proxy from ProfileData
                var pDetail = await _service.GetProfileAsync(p.Id);
                if (pDetail != null)
                {
                    try
                    {
                        var doc = JsonDocument.Parse(pDetail.ProfileData ?? "{}");
                        if (doc.RootElement.TryGetProperty("Network", out var net) &&
                        net.TryGetProperty("Proxy", out var proxy) &&
                        proxy.TryGetProperty("Mode", out var mode) && mode.GetString() == "custom")
                    {
                        var host = proxy.TryGetProperty("Host", out var h) ? h.GetString() : "";
                        var port = proxy.TryGetProperty("Port", out var pt) ? pt.ToString() : "";
                        var user = proxy.TryGetProperty("Username", out var u) ? u.GetString() : "";
                        var pass = proxy.TryGetProperty("Password", out var pwd) ? pwd.GetString() : "";

                        if (!string.IsNullOrEmpty(host) && !string.IsNullOrEmpty(port))
                        {
                            var str = $"{host}:{port}";
                            if (!string.IsNullOrEmpty(user)) str += $":{user}";
                            if (!string.IsNullOrEmpty(pass)) str += $":{pass}";
                            
                            // avoid duplicating if they are the exact same
                            if (!proxyStrings.Contains(str))
                                proxyStrings.Add(str);
                        }
                    }
                }
                catch { }
                }

                if (proxyStrings.Count > 0)
                    lines.Add(string.Join(" ", proxyStrings));
            }

            if (lines.Count > 0)
            {
                var finalString = string.Join("\n", lines);
                var t = new System.Threading.Thread(() => System.Windows.Clipboard.SetText(finalString));
                t.SetApartmentState(System.Threading.ApartmentState.STA);
                t.Start();
                t.Join();
                return (true, null, WrapInElement(new { success = true, copied = lines.Count }));
            }
            return (false, "No proxies found to copy", null);
        }

        private async Task<(bool, string?, JsonElement?)> RemoveProxyAsync(JsonElement? payload)
        {
            if (!payload.HasValue || !payload.Value.TryGetProperty("ids", out var idsEl) || idsEl.ValueKind != JsonValueKind.Array)
                return (false, "Missing 'ids' array", null);

            var ids = idsEl.EnumerateArray().Select(e => e.GetInt32()).ToList();
            int count = 0;
            foreach (var id in ids)
            {
                var p = await _service.GetProfileAsync(id);
                if (p == null) continue;

                bool changed = false;
                if (p.ProxyId.HasValue)
                {
                    p.ProxyId = null;
                    changed = true;
                }

                // 2. Proxy from ProfileData
                var pDetail = await _service.GetProfileAsync(p.Id);
                if (pDetail != null)
                {
                    try
                    {
                        var doc = JsonDocument.Parse(pDetail.ProfileData ?? "{}");
                        var root = doc.RootElement;
                        if (root.TryGetProperty("Network", out var net) && net.TryGetProperty("Proxy", out var proxy))
                        {
                            var mode = proxy.TryGetProperty("Mode", out var m) ? m.GetString() : "";
                            if (mode == "custom" || mode != "direct")
                            {
                                // We need to modify the ProfileData JSON to remove custom proxy
                                // The easiest way is to serialize it to a dictionary, update it, and reserialize
                                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(pDetail.ProfileData ?? "{}") ?? new();
                                if (dict.TryGetValue("Network", out var netObj) && netObj is JsonElement netEl)
                                {
                                    var netDict = JsonSerializer.Deserialize<Dictionary<string, object>>(netEl.GetRawText()) ?? new();
                                    if (netDict.TryGetValue("Proxy", out var proxyObj) && proxyObj is JsonElement proxyEl)
                                    {
                                        var proxyDict = JsonSerializer.Deserialize<Dictionary<string, object>>(proxyEl.GetRawText()) ?? new();
                                        proxyDict["Mode"] = "direct";
                                        netDict["Proxy"] = proxyDict;
                                        dict["Network"] = netDict;
                                        pDetail.ProfileData = JsonSerializer.Serialize(dict);
                                        changed = true;
                                    }
                                }
                            }
                        }
                    }
                    catch { }

                    if (changed)
                    {
                        var updateReq = new Models.DTOs.ProfileUpdateRequest(
                            pDetail.Id,
                            pDetail.Name,
                            pDetail.GroupId,
                            pDetail.TagIds,
                            null,
                            pDetail.BrowserType,
                            pDetail.BrowserVersion,
                            pDetail.ProfileData,
                            pDetail.Notes,
                            pDetail.Cookies
                        );
                        await _service.UpdateProfileAsync(updateReq);
                        count++;
                    }
                }
            }

            return (true, null, WrapInElement(new { success = true, removed = count }));
        }

        private async Task<(bool, string?, JsonElement?)> ImportProxiesAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);

            var root = payload.Value;
            if (!root.TryGetProperty("proxies", out var proxiesEl) || proxiesEl.ValueKind != JsonValueKind.Array)
                return (false, "Missing 'proxies' array", null);
            
            var proxies = proxiesEl.EnumerateArray().Select(e => e.GetString()).Where(s => !string.IsNullOrEmpty(s)).ToList();
            if (proxies.Count == 0) return (false, "No valid proxies provided", null);

            var targetVal = root.TryGetProperty("targetVal", out var tv) ? tv.GetString() : "selected";
            var ruleVal = root.TryGetProperty("ruleVal", out var rv) ? rv.GetString() : "round-robin";

            var profilesResponse = await _service.GetProfilesAsync();
            var allProfiles = profilesResponse.Items.ToList();
            var targetProfiles = new List<Models.DTOs.ProfileListItem>();

            if (targetVal == "selected")
            {
                if (root.TryGetProperty("selectedIds", out var selIdsEl) && selIdsEl.ValueKind == JsonValueKind.Array)
                {
                    var selIds = selIdsEl.EnumerateArray().Select(e => e.GetInt32()).ToList();
                    targetProfiles = allProfiles.Where(p => selIds.Contains(p.Id)).ToList();
                }
            }
            else if (targetVal == "group")
            {
                if (root.TryGetProperty("groupVal", out var gvEl))
                {
                    var gvStr = gvEl.GetString();
                    if (int.TryParse(gvStr, out int gId))
                    {
                        targetProfiles = allProfiles.Where(p => p.GroupId == gId).ToList();
                    }
                }
            }
            else if (targetVal == "all")
            {
                targetProfiles = allProfiles;
            }

            if (targetProfiles.Count == 0)
                return (false, "No target profiles found", null);

            int successCount = 0;

            for (int i = 0; i < targetProfiles.Count; i++)
            {
                var p = targetProfiles[i];
                string proxyStr = "";

                if (ruleVal == "round-robin")
                    proxyStr = proxies[i % proxies.Count]!;
                else if (ruleVal == "sequential")
                {
                    if (i < proxies.Count) proxyStr = proxies[i]!;
                    else break; // Run out of proxies
                }
                else if (ruleVal == "same")
                    proxyStr = proxies[0]!;

                if (string.IsNullOrEmpty(proxyStr)) continue;

                // Parse proxy string (e.g. 127.0.0.1:8080:user:pass)
                // or http://user:pass@host:port
                var host = "";
                var port = "";
                var user = "";
                var pass = "";

                if (proxyStr.Contains("://"))
                {
                    try
                    {
                        var uri = new Uri(proxyStr);
                        host = uri.Host;
                        port = uri.Port.ToString();
                        var userInfo = uri.UserInfo.Split(':');
                        if (userInfo.Length >= 1) user = userInfo[0];
                        if (userInfo.Length >= 2) pass = string.Join(":", userInfo.Skip(1)); // password có thể chứa :
                    }
                    catch { }
                }
                else
                {
                    var parts = proxyStr.Split(':');
                    if (parts.Length >= 2)
                    {
                        host = parts[0];
                        port = parts[1];
                        if (parts.Length >= 3) user = parts[2];
                        if (parts.Length >= 4) pass = string.Join(":", parts.Skip(3)); // password có thể chứa :
                    }
                }

                if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(port)) continue;

                // Parse port to int
                if (!int.TryParse(port, out int portInt)) continue;

                // Modifying ProfileData
                try
                {
                    var pDetail = await _service.GetProfileAsync(p.Id);
                    if (pDetail == null) continue;

                    var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(pDetail.ProfileData ?? "{}") ?? new();
                    var netDict = new Dictionary<string, object>();
                    if (dict.TryGetValue("Network", out var netObj) && netObj is JsonElement netEl)
                        netDict = JsonSerializer.Deserialize<Dictionary<string, object>>(netEl.GetRawText()) ?? new();

                    var proxyDict = new Dictionary<string, object>();
                    if (netDict.TryGetValue("Proxy", out var proxyObj) && proxyObj is JsonElement proxyEl)
                        proxyDict = JsonSerializer.Deserialize<Dictionary<string, object>>(proxyEl.GetRawText()) ?? new();

                    proxyDict["Mode"] = "custom";
                    proxyDict["Type"] = "http"; // default to http, could be extracted from URL scheme
                    proxyDict["Host"] = host;
                    proxyDict["Port"] = portInt; // int for JSON number
                    proxyDict["Username"] = user;
                    proxyDict["Password"] = pass;

                    netDict["Proxy"] = proxyDict;
                    dict["Network"] = netDict;

                    var newProfileData = JsonSerializer.Serialize(dict);
                    
                    var updateReq = new Models.DTOs.ProfileUpdateRequest(
                        pDetail.Id,
                        pDetail.Name,
                        pDetail.GroupId,
                        pDetail.TagIds,
                        null, // Clear backend ProxyId since we use ProfileData
                        pDetail.BrowserType,
                        pDetail.BrowserVersion,
                        newProfileData,
                        pDetail.Notes,
                        pDetail.Cookies
                    );
                    
                    await _service.UpdateProfileAsync(updateReq);
                    successCount++;
                }
                catch { }
            }

            return (true, null, WrapInElement(new { success = true, imported = successCount }));
        }

        private async Task<(bool, string?, JsonElement?)> ExportProfilesAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);
            var root = payload.Value;

            var format = root.TryGetProperty("format", out var f) ? f.GetString() : "duckprofile";
            if (!root.TryGetProperty("ids", out var idsEl) || idsEl.ValueKind != JsonValueKind.Array)
                return (false, "Missing 'ids' array", null);

            var ids = idsEl.EnumerateArray().Select(e => e.GetInt32()).ToList();
            var profiles = new List<Models.DTOs.ProfileDetailItem>();
            foreach(var id in ids)
            {
                var p = await _service.GetProfileAsync(id);
                if (p != null) profiles.Add(p);
            }

            if (profiles.Count == 0) return (false, "No profiles found to export", null);

            if (format == "json" || format == "txt")
            {
                if (profiles.Count != 1) return (false, "This format requires exactly 1 profile to be selected", null);
                var p = profiles[0];

                if (format == "json")
                {
                    return (true, null, WrapInElement(new { success = true, fileName = $"{p.Name}_fingerprint.json", data = p.ProfileData }));
                }
                else if (format == "txt")
                {
                    var cookies = p.Cookies ?? "[]";
                    // Simplistic Netscape format conversion is complex, we just export the JSON array as text for now, 
                    // or maybe it's already expected to be netscape-like?
                    // "Imports cookies" implies they can import it back. 
                    return (true, null, WrapInElement(new { success = true, fileName = $"{p.Name}_cookies.txt", data = cookies }));
                }
            }
            else if (format == "duckprofile")
            {
                var serialized = JsonSerializer.Serialize(profiles, new JsonSerializerOptions { WriteIndented = true });
                return (true, null, WrapInElement(new { success = true, fileName = $"Export_{profiles.Count}_profiles.duckprofile", data = serialized }));
            }

            return (false, "Unsupported format", null);
        }

        private async Task<(bool, string?, JsonElement?)> ImportProfilesAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);
            var root = payload.Value;

            var format = root.TryGetProperty("format", out var f) ? f.GetString() : "duckprofile";
            var targetId = root.TryGetProperty("targetId", out var tid) ? tid.GetInt32() : 0;

            if (format == "json" || format == "txt")
            {
                if (targetId == 0) return (false, "Missing target profile ID", null);
                var p = await _service.GetProfileAsync(targetId);
                if (p == null) return (false, "Target profile not found", null);

                var data = root.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : "{}";

                if (format == "json")
                {
                    // It's fingerprint JSON (or full ProfileData)
                    // If it's pure fingerprint object we merge it, or just replace ProfileData.
                    p.ProfileData = data;
                }
                else if (format == "txt")
                {
                    // Update cookies
                    p.Cookies = data;
                }

                var updateReq = new Models.DTOs.ProfileUpdateRequest(
                    p.Id,
                    p.Name,
                    p.GroupId,
                    p.TagIds,
                    null,
                    p.BrowserType,
                    p.BrowserVersion,
                    p.ProfileData,
                    p.Notes,
                    p.Cookies
                );
                await _service.UpdateProfileAsync(updateReq);
                return (true, null, WrapInElement(new { success = true }));
            }
            else if (format == "duckprofile")
            {
                if (!root.TryGetProperty("data", out var dataEl) || dataEl.ValueKind != JsonValueKind.Array)
                    return (false, "Invalid .duckprofile data", null);

                int count = 0;
                foreach (var item in dataEl.EnumerateArray())
                {
                    try
                    {
                        var req = new Models.DTOs.ProfileCreateRequest(
                            Name: item.TryGetProperty("Name", out var n) ? n.GetString() ?? "Imported" : "Imported",
                            GroupId: null, // Clear group since it might not exist
                            TagIds: new List<int>(), // Clear tags
                            ProxyId: null,
                            BrowserType: item.TryGetProperty("BrowserType", out var bt) ? bt.GetString() ?? "Chromium" : "Chromium",
                            BrowserVersion: item.TryGetProperty("BrowserVersion", out var bv) ? bv.GetString() ?? "" : "",
                            ProfileData: item.TryGetProperty("ProfileData", out var pd) && pd.ValueKind == JsonValueKind.String ? pd.GetString() ?? "{}" : "{}",
                            Notes: item.TryGetProperty("Notes", out var no) ? no.GetString() ?? "" : "",
                            StartUrl: null,
                            CookiesData: null,
                            CookiesFileName: null,
                            Cookies: item.TryGetProperty("Cookies", out var ck) ? ck.GetString() ?? "[]" : "[]",
                            Fingerprint: null
                        );
                        
                        await _service.CreateProfileAsync(req);
                        count++;
                    }
                    catch { }
                }
                return (true, null, WrapInElement(new { success = true, imported = count }));
            }

            return (false, "Unsupported format", null);
        }

        private async Task<(bool, string?, JsonElement?)> GetResourceAsync(JsonElement? payload)
        {
            if (payload == null || !payload.Value.TryGetProperty("id", out var idProp))
                return (false, "Missing profile ID", null);

            var id = idProp.GetInt32();
            var profile = await _service.GetProfileAsync(id);
            if (profile == null) return (false, "Profile not found", null);

            var resourceData = profile.Resource ?? "[]";
            var resObj = new { resource = resourceData };
            return (true, null, JsonSerializer.SerializeToElement(resObj));
        }

        private async Task<(bool, string?, JsonElement?)> UpdateResourceAsync(JsonElement? payload)
        {
            if (payload == null) return (false, "Missing payload", null);

            if (!payload.Value.TryGetProperty("id", out var idProp) || 
                !payload.Value.TryGetProperty("resource", out var resProp))
            {
                return (false, "Missing id or resource", null);
            }

            var id = idProp.GetInt32();
            var resourceStr = resProp.GetString() ?? "[]";

            await _service.UpdateProfileResourceAsync(id, resourceStr);
            return (true, null, JsonSerializer.SerializeToElement(new { success = true }));
        }

        private async Task<(bool, string?, JsonElement?)> ParseFileAsync(JsonElement? payload)
        {
            if (!payload.HasValue) return (false, "Missing payload", null);

            try
            {
                var content = "";
                
                if (payload.Value.TryGetProperty("content", out var contentProp) && contentProp.ValueKind == JsonValueKind.String)
                    content = contentProp.GetString() ?? "";

                if (string.IsNullOrEmpty(content))
                    return (false, "Missing content", null);

                var items = await _proxyService.ParseProxiesFromContentAsync(content);

                return (true, null, WrapInElement(new { 
                    proxies = items,
                    total = items.Count
                }));
            }
            catch (Exception ex)
            {
                return (false, ex.Message, null);
            }
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