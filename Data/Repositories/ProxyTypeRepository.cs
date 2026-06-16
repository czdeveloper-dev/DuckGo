using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProxyTypeRepository : IProxyTypeRepository
{
    private readonly DatabaseService _db;

    public ProxyTypeRepository(DatabaseService db) => _db = db;

    public async Task<List<ProxyType>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProxyTypes ORDER BY DisplayOrder";
        await using var reader = await cmd.ExecuteReaderAsync();
        var types = new List<ProxyType>();
        while (await reader.ReadAsync())
            types.Add(Read(reader));
        return types;
    }

    private static ProxyType Read(SqliteDataReader reader) => new()
    {
        Id = reader.GetInt32(reader.GetOrdinal("Id")),
        Value = reader.GetString(reader.GetOrdinal("Value")),
        Label = reader.GetString(reader.GetOrdinal("Label")),
        DisplayOrder = reader.GetInt32(reader.GetOrdinal("DisplayOrder"))
    };

    public async Task<ProxyType?> GetByIdAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProxyTypes WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
            return Read(reader);
        return null;
    }

    public async Task<ProxyType?> GetByValueAsync(string value)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM ProxyTypes WHERE LOWER(Value) = LOWER(@value)";
        cmd.Parameters.AddWithValue("@value", value);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
            return Read(reader);
        return null;
    }
}
