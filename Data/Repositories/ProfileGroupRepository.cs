using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProfileGroupRepository : IProfileGroupRepository
{
    private readonly DatabaseService _db;

    public ProfileGroupRepository(DatabaseService db) => _db = db;

    public async Task<List<ProfileGroup>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProfileGroups ORDER BY Name";
        await using var reader = await cmd.ExecuteReaderAsync();
        var groups = new List<ProfileGroup>();
        while (await reader.ReadAsync())
            groups.Add(new ProfileGroup
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Name = reader.GetString(reader.GetOrdinal("Name")),
                CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt"))
                    ? DateTime.Now
                    : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt")))
            });
        return groups;
    }

    public async Task<ProfileGroup?> GetByIdAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProfileGroups WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return null;
        return new ProfileGroup
        {
            Id = reader.GetInt32(reader.GetOrdinal("Id")),
            Name = reader.GetString(reader.GetOrdinal("Name")),
            CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt"))
                ? DateTime.Now
                : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt")))
        };
    }

    public async Task<bool> ExistsByNameAsync(string name, int? excludeId = null)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        if (excludeId.HasValue)
        {
            cmd.CommandText = "SELECT COUNT(*) FROM ProfileGroups WHERE LOWER(Name) = LOWER(@name) AND Id != @excludeId";
            cmd.Parameters.AddWithValue("@excludeId", excludeId.Value);
        }
        else
        {
            cmd.CommandText = "SELECT COUNT(*) FROM ProfileGroups WHERE LOWER(Name) = LOWER(@name)";
        }
        cmd.Parameters.AddWithValue("@name", name);
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        return count > 0;
    }

    public async Task<int> CreateAsync(ProfileGroup group)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO ProfileGroups (Name, CreatedAt) VALUES (@name, @createdAt); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", group.Name);
        cmd.Parameters.AddWithValue("@createdAt", group.CreatedAt.ToString("o"));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task UpdateAsync(ProfileGroup group)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE ProfileGroups SET Name = @name WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", group.Id);
        cmd.Parameters.AddWithValue("@name", group.Name);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM ProfileGroups WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteWithProxiesAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        
        // Xóa proxies trong group trước
        await using var deleteProxiesCmd = conn.CreateCommand();
        deleteProxiesCmd.CommandText = "DELETE FROM Proxies WHERE GroupId = @groupId";
        deleteProxiesCmd.Parameters.AddWithValue("@groupId", id);
        await deleteProxiesCmd.ExecuteNonQueryAsync();
        
        // Xóa group
        await using var deleteGroupCmd = conn.CreateCommand();
        deleteGroupCmd.CommandText = "DELETE FROM ProfileGroups WHERE Id = @id";
        deleteGroupCmd.Parameters.AddWithValue("@id", id);
        await deleteGroupCmd.ExecuteNonQueryAsync();
    }
}
