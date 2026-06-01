using DuckGo.Models.Entities;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data.Repositories;

public class ProxyRepository : IProxyRepository
{
    private readonly DatabaseService _db;

    public ProxyRepository(DatabaseService db) => _db = db;

    public async Task<List<Proxy>> GetAllAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Proxies ORDER BY Name";
        await using var reader = await cmd.ExecuteReaderAsync();
        var proxies = new List<Proxy>();
        while (await reader.ReadAsync())
            proxies.Add(ReadProxy(reader));
        return proxies;
    }

    public async Task<Proxy?> GetByIdAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Proxies WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? ReadProxy(reader) : null;
    }

    public async Task<int> CreateAsync(Proxy proxy)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO Proxies (Name, Type, Host, Port, Username, Password, Status, CreatedAt)
            VALUES (@name, @type, @host, @port, @username, @password, @status, @createdAt);
            SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("@name", proxy.Name);
        cmd.Parameters.AddWithValue("@type", proxy.Type);
        cmd.Parameters.AddWithValue("@host", proxy.Host);
        cmd.Parameters.AddWithValue("@port", proxy.Port);
        cmd.Parameters.AddWithValue("@username", proxy.Username);
        cmd.Parameters.AddWithValue("@password", proxy.Password);
        cmd.Parameters.AddWithValue("@status", proxy.Status);
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
                Name = @name, Type = @type, Host = @host, Port = @port,
                Username = @username, Password = @password, Status = @status
            WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", proxy.Id);
        cmd.Parameters.AddWithValue("@name", proxy.Name);
        cmd.Parameters.AddWithValue("@type", proxy.Type);
        cmd.Parameters.AddWithValue("@host", proxy.Host);
        cmd.Parameters.AddWithValue("@port", proxy.Port);
        cmd.Parameters.AddWithValue("@username", proxy.Username);
        cmd.Parameters.AddWithValue("@password", proxy.Password);
        cmd.Parameters.AddWithValue("@status", proxy.Status);
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

    private static Proxy ReadProxy(SqliteDataReader reader) => new()
    {
        Id = reader.GetInt32(reader.GetOrdinal("Id")),
        Name = reader.GetString(reader.GetOrdinal("Name")),
        Type = reader.GetString(reader.GetOrdinal("Type")),
        Host = reader.GetString(reader.GetOrdinal("Host")),
        Port = reader.GetInt32(reader.GetOrdinal("Port")),
        Username = reader.IsDBNull(reader.GetOrdinal("Username")) ? "" : reader.GetString(reader.GetOrdinal("Username")),
        Password = reader.IsDBNull(reader.GetOrdinal("Password")) ? "" : reader.GetString(reader.GetOrdinal("Password")),
        Status = reader.GetString(reader.GetOrdinal("Status")),
        CreatedAt = reader.IsDBNull(reader.GetOrdinal("CreatedAt"))
            ? DateTime.Now
            : DateTime.Parse(reader.GetString(reader.GetOrdinal("CreatedAt")))
    };
}
