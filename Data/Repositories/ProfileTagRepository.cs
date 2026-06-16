using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProfileTagRepository : IProfileTagRepository
{
    private readonly DatabaseService _db;

    public ProfileTagRepository(DatabaseService db) => _db = db;

    public async Task<List<ProfileTag>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProfileTags ORDER BY Name";
        await using var reader = await cmd.ExecuteReaderAsync();
        var tags = new List<ProfileTag>();
        while (await reader.ReadAsync())
            tags.Add(new ProfileTag
            {
                Id = reader.GetInt32(reader.GetOrdinal("Id")),
                Name = reader.GetString(reader.GetOrdinal("Name")),
                CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt"))
                    ? DateTime.Now
                    : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt")))
            });
        return tags;
    }

    public async Task<bool> ExistsByNameAsync(string name, int? excludeId = null)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        if (excludeId.HasValue)
        {
            cmd.CommandText = "SELECT COUNT(*) FROM ProfileTags WHERE LOWER(Name) = LOWER(@name) AND Id != @excludeId";
            cmd.Parameters.AddWithValue("@excludeId", excludeId.Value);
        }
        else
        {
            cmd.CommandText = "SELECT COUNT(*) FROM ProfileTags WHERE LOWER(Name) = LOWER(@name)";
        }
        cmd.Parameters.AddWithValue("@name", name);
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        return count > 0;
    }

    public async Task<int> CreateAsync(ProfileTag tag)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO ProfileTags (Name, CreatedAt) VALUES (@name, @createdAt); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", tag.Name);
        cmd.Parameters.AddWithValue("@createdAt", tag.CreatedAt.ToString("o"));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task UpdateAsync(int id, string name)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE ProfileTags SET Name = @name WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", name);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM ProfileTags WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
