using System.IO;
using Microsoft.Data.Sqlite;

namespace DuckGo.Data;

public class DatabaseService : IDisposable
{
    public string ConnectionString { get; }

    public DatabaseService()
    {
        Directory.CreateDirectory(AppConfig.DatabaseDir);
        ConnectionString = $"Data Source={AppConfig.DatabasePath}";
    }

    public SqliteConnection GetConnection() => new(ConnectionString);

    public async Task InitializeAsync()
    {
        await using var conn = GetConnection();
        await conn.OpenAsync();

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Groups (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Tags (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Profiles (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                GroupId INTEGER,
                Tags TEXT DEFAULT '[]',
                ProxyId INTEGER,
                BrowserType TEXT DEFAULT 'Chromium',
                ProfileData TEXT DEFAULT '{}',
                Notes TEXT DEFAULT '',
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                LastOpened TEXT,
                FOREIGN KEY (GroupId) REFERENCES Groups(Id) ON DELETE SET NULL
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Proxies (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Type TEXT DEFAULT 'http',
                Host TEXT NOT NULL,
                Port INTEGER NOT NULL,
                Username TEXT DEFAULT '',
                Password TEXT DEFAULT '',
                Status TEXT DEFAULT 'active',
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");
    }

    private static async Task RunNonQueryAsync(SqliteConnection conn, string sql)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }

    public void Dispose() { }
}
