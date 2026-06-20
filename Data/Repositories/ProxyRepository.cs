using System.Text;
using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProxyRepository : IProxyRepository
{
    private readonly DatabaseService _db;

    public ProxyRepository(DatabaseService db) => _db = db;

    public async Task<List<Proxy>> GetAllAsync(
        string? search = null,
        string? idStr = null,
        int? groupId = null,
        List<int>? tagIds = null)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var sql = new StringBuilder();
        sql.AppendLine("SELECT p.*, g.Name as GroupName");
        sql.AppendLine("FROM Proxies p");
        sql.AppendLine("LEFT JOIN ProfileGroups g ON p.GroupId = g.Id");
        sql.AppendLine("WHERE 1=1");

        var args = new List<(string name, object value)>();

        // ID filter (supports "1,2,3" or "1-5")
        if (!string.IsNullOrWhiteSpace(idStr))
        {
            var ids = new List<int>();
            var parts = idStr.Split(',', StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                if (part.Contains('-'))
                {
                    var range = part.Split('-', 2);
                    if (range.Length == 2 && int.TryParse(range[0].Trim(), out var start) && int.TryParse(range[1].Trim(), out var end))
                    {
                        if (start <= end) ids.AddRange(Enumerable.Range(start, end - start + 1));
                    }
                }
                else if (int.TryParse(part.Trim(), out var singleId))
                {
                    ids.Add(singleId);
                }
            }
            if (ids.Count > 0)
            {
                var idParams = string.Join(",", ids.Select((_, i) => $"@id{i}"));
                sql.Append($" AND p.Id IN ({idParams})");
                for (var i = 0; i < ids.Count; i++) args.Add(($"id{i}", ids[i]));
            }
            else
            {
                sql.Append(" AND 1=0");
            }
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql.Append(" AND p.Name LIKE @search");
            args.Add(("search", $"%{search}%"));
        }

        // Group filter
        if (groupId.HasValue)
        {
            sql.Append(" AND p.GroupId = @groupId");
            args.Add(("groupId", groupId.Value));
        }

        // Tag filter
        if (tagIds != null && tagIds.Count > 0)
        {
            var tagClauses = string.Join(" OR ", tagIds.Select((_, i) => $"EXISTS (SELECT 1 FROM json_each(p.Tags) WHERE value = @tag{i})"));
            sql.Append($" AND ({tagClauses})");
            for (var i = 0; i < tagIds.Count; i++)
                args.Add(($"tag{i}", tagIds[i]));
        }

        sql.Append(" ORDER BY p.CreatedAt ASC");

        var proxies = new List<Proxy>();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql.ToString();
        foreach (var (name, value) in args)
            cmd.Parameters.AddWithValue("@" + name, value);

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var p = ReadProxy(reader);
            p.GroupName = reader.IsDBNull(reader.GetOrdinal("GroupName")) ? null : reader.GetString(reader.GetOrdinal("GroupName"));
            proxies.Add(p);
        }

        return proxies;
    }

    public async Task<Proxy?> GetByIdAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT p.*, g.Name as GroupName
            FROM Proxies p
            LEFT JOIN ProfileGroups g ON p.GroupId = g.Id
            WHERE p.Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        var p = ReadProxy(reader);
        p.GroupName = reader.IsDBNull(reader.GetOrdinal("GroupName")) ? null : reader.GetString(reader.GetOrdinal("GroupName"));
        return p;
    }

    public async Task<int> CreateAsync(Proxy proxy)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO Proxies (Name, TypeId, GroupId, Tags, Host, Port, Username, Password, RotaryApi, Notes, CreatedAt)
            VALUES (@name, @typeId, @groupId, @tags, @host, @port, @username, @password, @rotaryApi, @notes, @createdAt);
            SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", proxy.Name);
        cmd.Parameters.AddWithValue("@typeId", proxy.TypeId.HasValue ? proxy.TypeId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@groupId", proxy.GroupId.HasValue ? proxy.GroupId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@tags", proxy.Tags);
        cmd.Parameters.AddWithValue("@host", proxy.Host);
        cmd.Parameters.AddWithValue("@port", proxy.Port);
        cmd.Parameters.AddWithValue("@username", proxy.Username ?? "");
        cmd.Parameters.AddWithValue("@password", proxy.Password ?? "");
        cmd.Parameters.AddWithValue("@rotaryApi", proxy.RotaryApi ?? "");
        cmd.Parameters.AddWithValue("@notes", proxy.Notes ?? "");
        cmd.Parameters.AddWithValue("@createdAt", proxy.CreatedAt.ToString("o"));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task UpdateAsync(Proxy proxy)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE Proxies SET
                Name = @name, TypeId = @typeId, GroupId = @groupId, Tags = @tags,
                Host = @host, Port = @port, Username = @username, Password = @password,
                RotaryApi = @rotaryApi, Notes = @notes
            WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", proxy.Id);
        cmd.Parameters.AddWithValue("@name", proxy.Name);
        cmd.Parameters.AddWithValue("@typeId", proxy.TypeId.HasValue ? proxy.TypeId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@groupId", proxy.GroupId.HasValue ? proxy.GroupId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@tags", proxy.Tags);
        cmd.Parameters.AddWithValue("@host", proxy.Host);
        cmd.Parameters.AddWithValue("@port", proxy.Port);
        cmd.Parameters.AddWithValue("@username", proxy.Username ?? "");
        cmd.Parameters.AddWithValue("@password", proxy.Password ?? "");
        cmd.Parameters.AddWithValue("@rotaryApi", proxy.RotaryApi ?? "");
        cmd.Parameters.AddWithValue("@notes", proxy.Notes ?? "");
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateNameAsync(int id, string name)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Proxies SET Name = @name WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", name);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateNotesAsync(int id, string notes)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Proxies SET Notes = @notes WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@notes", notes);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Proxies WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task BulkDeleteAsync(List<int> ids)
    {
        if (ids.Count == 0) return;
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        var idsStr = string.Join(",", ids);
        cmd.CommandText = $"DELETE FROM Proxies WHERE Id IN ({idsStr})";
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<Proxy>> GetByIdsAsync(List<int> ids)
    {
        if (ids.Count == 0) return new List<Proxy>();
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        var idParams = string.Join(",", ids.Select((_, i) => $"@id{i}"));
        cmd.CommandText = $@"
            SELECT p.*, g.Name as GroupName
            FROM Proxies p
            LEFT JOIN ProfileGroups g ON p.GroupId = g.Id
            WHERE p.Id IN ({idParams})";
        for (var i = 0; i < ids.Count; i++)
            cmd.Parameters.AddWithValue($"@id{i}", ids[i]);
        var proxies = new List<Proxy>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var p = ReadProxy(reader);
            p.GroupName = reader.IsDBNull(reader.GetOrdinal("GroupName")) ? null : reader.GetString(reader.GetOrdinal("GroupName"));
            proxies.Add(p);
        }
        return proxies;
    }

    public async Task UpdateStatusAsync(int id, string status, int latencyMs, string? message)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Proxies SET Status = @status, LatencyMs = @latencyMs, Message = @message WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@latencyMs", latencyMs);
        cmd.Parameters.AddWithValue("@message", message ?? (object)DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task BulkDeleteByGroupAsync(int groupId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Proxies WHERE GroupId = @groupId";
        cmd.Parameters.AddWithValue("@groupId", groupId);
        await cmd.ExecuteNonQueryAsync();
    }

    private static Proxy ReadProxy(SqliteDataReader reader) => new()
    {
        Id = reader.GetInt32(reader.GetOrdinal("Id")),
        Name = reader.GetString(reader.GetOrdinal("Name")),
        TypeId = reader.IsDBNull(reader.GetOrdinal("TypeId")) ? null : reader.GetInt32(reader.GetOrdinal("TypeId")),
        GroupId = reader.IsDBNull(reader.GetOrdinal("GroupId")) ? null : reader.GetInt32(reader.GetOrdinal("GroupId")),
        Tags = reader.IsDBNull(reader.GetOrdinal("Tags")) ? "[]" : reader.GetString(reader.GetOrdinal("Tags")),
        Host = reader.GetString(reader.GetOrdinal("Host")),
        Port = reader.GetInt32(reader.GetOrdinal("Port")),
        Username = reader.IsDBNull(reader.GetOrdinal("Username")) ? "" : reader.GetString(reader.GetOrdinal("Username")),
        Password = reader.IsDBNull(reader.GetOrdinal("Password")) ? "" : reader.GetString(reader.GetOrdinal("Password")),
        RotaryApi = reader.IsDBNull(reader.GetOrdinal("RotaryApi")) ? "" : reader.GetString(reader.GetOrdinal("RotaryApi")),
        Notes = reader.IsDBNull(reader.GetOrdinal("Notes")) ? "" : reader.GetString(reader.GetOrdinal("Notes")),
        CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt"))
            ? DateTime.Now
            : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt")))
    };
}
