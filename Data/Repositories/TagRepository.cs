using DuckGo.Models.Entities;

namespace DuckGo.Data.Repositories;

public class TagRepository : ITagRepository
{
    private readonly DatabaseService _db;

    public TagRepository(DatabaseService db) => _db = db;

    public async Task<List<ProfileTag>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Tags ORDER BY Name";
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

    public async Task<int> CreateAsync(ProfileTag tag)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO Tags (Name, CreatedAt) VALUES (@name, @createdAt); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", tag.Name);
        cmd.Parameters.AddWithValue("@createdAt", tag.CreatedAt.ToString("o"));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Tags WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }
}
