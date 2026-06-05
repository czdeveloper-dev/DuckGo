using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProfileRepository : IProfileRepository
{
    private readonly DatabaseService _db;

    public ProfileRepository(DatabaseService db) => _db = db;

    public async Task<List<Profile>> GetAllAsync(string? search = null, int? id = null, int? groupId = null, List<int>? tagIds = null, string? browserType = null)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var sql = @"
            SELECT p.*,
                   g.Name as GroupName,
                   pr.Name as ProxyName
            FROM Profiles p
            LEFT JOIN Groups g ON p.GroupId = g.Id
            LEFT JOIN Proxies pr ON p.ProxyId = pr.Id
            WHERE 1=1";
        var args = new List<(string name, object value)>();

        if (id.HasValue)
        {
            sql += " AND p.Id = @id";
            args.Add(("id", id.Value));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND p.Name LIKE @search";
            args.Add(("search", $"%{search}%"));
        }
        if (groupId.HasValue)
        {
            sql += " AND p.GroupId = @groupId";
            args.Add(("groupId", groupId.Value));
        }
        if (!string.IsNullOrWhiteSpace(browserType))
        {
            sql += " AND p.BrowserType = @browserType";
            args.Add(("browserType", browserType));
        }

        if (tagIds != null && tagIds.Count > 0)
        {
            var tagClauses = string.Join(" OR ", tagIds.Select((_, i) => $"(p.Tags LIKE @tag{i} ESCAPE '\\')"));
            sql += $" AND ({tagClauses})";
            for (var i = 0; i < tagIds.Count; i++)
                args.Add(($"tag{i}", $"%{tagIds[i]}%"));
        }

        sql += " ORDER BY p.CreatedAt DESC";

        var profiles = new List<Profile>();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (name, value) in args)
            cmd.Parameters.AddWithValue("@" + name, value);

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var p = ReadProfile(reader);
            p.GroupName = reader.IsDBNull(reader.GetOrdinal("GroupName")) ? null : reader.GetString(reader.GetOrdinal("GroupName"));
            p.ProxyName = reader.IsDBNull(reader.GetOrdinal("ProxyName")) ? null : reader.GetString(reader.GetOrdinal("ProxyName"));
            profiles.Add(p);
        }

        return profiles;
    }

    public async Task<Profile?> GetByIdAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Profiles WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? ReadProfile(reader) : null;
    }

    public async Task<int> CreateAsync(Profile profile)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO Profiles (Name, GroupId, Tags, ProxyId, BrowserType, BrowserVersion, ProfileData, Notes, CreatedAt)
            VALUES (@name, @groupId, @tags, @proxyId, @browserType, @browserVersion, @profileData, @notes, @createdAt);
            SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", profile.Name);
        cmd.Parameters.AddWithValue("@groupId", profile.GroupId.HasValue ? profile.GroupId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@tags", profile.Tags);
        cmd.Parameters.AddWithValue("@proxyId", profile.ProxyId.HasValue ? profile.ProxyId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@browserType", profile.BrowserType);
        cmd.Parameters.AddWithValue("@browserVersion", string.IsNullOrWhiteSpace(profile.BrowserVersion) ? DBNull.Value : profile.BrowserVersion);
        cmd.Parameters.AddWithValue("@profileData", profile.ProfileData);
        cmd.Parameters.AddWithValue("@notes", profile.Notes);
        cmd.Parameters.AddWithValue("@createdAt", profile.CreatedAt.ToString("o"));
        var result = await cmd.ExecuteScalarAsync();
        return Convert.ToInt32(result);
    }

    public async Task UpdateAsync(Profile profile)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            UPDATE Profiles SET
                Name = @name, GroupId = @groupId, Tags = @tags,
                ProxyId = @proxyId, BrowserType = @browserType,
                BrowserVersion = @browserVersion,
                ProfileData = @profileData, Notes = @notes
            WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", profile.Id);
        cmd.Parameters.AddWithValue("@name", profile.Name);
        cmd.Parameters.AddWithValue("@groupId", profile.GroupId.HasValue ? profile.GroupId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@tags", profile.Tags);
        cmd.Parameters.AddWithValue("@proxyId", profile.ProxyId.HasValue ? profile.ProxyId.Value : DBNull.Value);
        cmd.Parameters.AddWithValue("@browserType", profile.BrowserType);
        cmd.Parameters.AddWithValue("@browserVersion", string.IsNullOrWhiteSpace(profile.BrowserVersion) ? DBNull.Value : profile.BrowserVersion);
        cmd.Parameters.AddWithValue("@profileData", profile.ProfileData);
        cmd.Parameters.AddWithValue("@notes", profile.Notes);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Profiles WHERE Id = @id";
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
        cmd.CommandText = $"DELETE FROM Profiles WHERE Id IN ({idsStr})";
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task BulkAssignGroupAsync(List<int> profileIds, int? groupId)
    {
        if (profileIds.Count == 0) return;
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        var idsStr = string.Join(",", profileIds);
        cmd.CommandText = $"UPDATE Profiles SET GroupId = @groupId WHERE Id IN ({idsStr})";
        cmd.Parameters.AddWithValue("@groupId", groupId.HasValue ? groupId.Value : DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateLastOpenedAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Profiles SET LastOpened = @lastOpened WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@lastOpened", DateTime.Now.ToString("o"));
        await cmd.ExecuteNonQueryAsync();
    }

    private static Profile ReadProfile(SqliteDataReader reader)
    {
        var ordinal = reader.GetOrdinal("Tags");
        var tagsJson = reader.IsDBNull(ordinal) ? "[]" : reader.GetString(ordinal);
        List<int> tagIds;
        try { tagIds = System.Text.Json.JsonSerializer.Deserialize<List<int>>(tagsJson) ?? new(); }
        catch { tagIds = new(); }

        return new Profile
        {
            Id = reader.GetInt32(reader.GetOrdinal("Id")),
            Name = reader.GetString(reader.GetOrdinal("Name")),
            GroupId = reader.IsDBNull(reader.GetOrdinal("GroupId")) ? null : reader.GetInt32(reader.GetOrdinal("GroupId")),
            Tags = tagsJson,
            TagIds = tagIds,
            ProxyId = reader.IsDBNull(reader.GetOrdinal("ProxyId")) ? null : reader.GetInt32(reader.GetOrdinal("ProxyId")),
            BrowserType = reader.GetString(reader.GetOrdinal("BrowserType")),
            BrowserVersion = reader.IsDBNull(reader.GetOrdinal("BrowserVersion")) ? "" : reader.GetString(reader.GetOrdinal("BrowserVersion")),
            ProfileData = reader.IsDBNull(reader.GetOrdinal("ProfileData")) ? "{}" : reader.GetString(reader.GetOrdinal("ProfileData")),
            Notes = reader.IsDBNull(reader.GetOrdinal("Notes")) ? "" : reader.GetString(reader.GetOrdinal("Notes")),
            CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt")) ? DateTime.Now : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt"))),
            LastOpened = reader.IsDBNull(reader.GetOrdinal("LastOpened")) ? null : DateTime.Parse(reader.GetString(reader.GetOrdinal("LastOpened")))
        };
    }
}
