using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public class GroupRepository : IGroupRepository
{
    private readonly DatabaseService _db;

    public GroupRepository(DatabaseService db) => _db = db;

    public async Task<List<ProfileGroup>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Groups ORDER BY Name";
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
        cmd.CommandText = "SELECT * FROM Groups WHERE Id = @id";
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

    public async Task<int> CreateAsync(ProfileGroup group)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO Groups (Name, CreatedAt) VALUES (@name, @createdAt); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", group.Name);
        cmd.Parameters.AddWithValue("@createdAt", group.CreatedAt.ToString("o"));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task UpdateAsync(ProfileGroup group)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE Groups SET Name = @name WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", group.Id);
        cmd.Parameters.AddWithValue("@name", group.Name);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Groups WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
