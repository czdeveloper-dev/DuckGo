using Microsoft.Data.Sqlite;

namespace DuckGo.Data;

public interface ISettingsRepository
{
    Task<string?> GetAsync(string key);
    Task SetAsync(string key, string value);
    Task DeleteAsync(string key);
}

public class SettingsRepository : ISettingsRepository
{
    private readonly string _connectionString;

    public SettingsRepository(DatabaseService db)
    {
        _connectionString = db.ConnectionString;
    }

    private SqliteConnection GetConnection() => new(_connectionString);

    public async Task<string?> GetAsync(string key)
    {
        await using var conn = GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Value FROM Settings WHERE Key = @key";
        cmd.Parameters.AddWithValue("@key", key);

        var result = await cmd.ExecuteScalarAsync();
        return result as string;
    }

    public async Task SetAsync(string key, string value)
    {
        await using var conn = GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO Settings (Key, Value, UpdatedAt) 
            VALUES (@key, @value, @updatedAt)
            ON CONFLICT(Key) DO UPDATE SET 
                Value = @value, 
                UpdatedAt = @updatedAt";
        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@value", value);
        cmd.Parameters.AddWithValue("@updatedAt", DateTime.Now.ToString("o"));

        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(string key)
    {
        await using var conn = GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM Settings WHERE Key = @key";
        cmd.Parameters.AddWithValue("@key", key);

        await cmd.ExecuteNonQueryAsync();
    }
}
