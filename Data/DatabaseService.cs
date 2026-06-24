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

        // ProfileGroups table
        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS ProfileGroups (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");

        // ProfileTags table
        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS ProfileTags (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Profiles (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Resource TEXT DEFAULT '',
                GroupId INTEGER,
                Tags TEXT DEFAULT '[]',
                ProxyId INTEGER,
                BrowserType TEXT DEFAULT 'Chromium',
                BrowserVersion TEXT DEFAULT '',
                Cookies TEXT DEFAULT '[]',
                ProfileData TEXT DEFAULT '{}',
                Notes TEXT DEFAULT '',
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                LastOpened TEXT,
                FOREIGN KEY (GroupId) REFERENCES ProfileGroups(Id) ON DELETE SET NULL
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Proxies (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                TypeId INTEGER,
                GroupId INTEGER,
                Tags TEXT DEFAULT '[]',
                Host TEXT NOT NULL,
                Port INTEGER NOT NULL,
                Username TEXT DEFAULT '',
                Password TEXT DEFAULT '',
                RotaryApi TEXT DEFAULT '',
                Notes TEXT DEFAULT '',
                CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (GroupId) REFERENCES ProfileGroups(Id) ON DELETE SET NULL,
                FOREIGN KEY (TypeId) REFERENCES ProxyTypes(Id) ON DELETE CASCADE
            )");

        // Add TypeId column if migrating from old schema (without TypeId)
        await EnsureColumnExistsAsync(conn, "Proxies", "TypeId", "ALTER TABLE Proxies ADD COLUMN TypeId INTEGER REFERENCES ProxyTypes(Id) ON DELETE CASCADE");

        // Status + Message columns for runtime state persistence
        await EnsureColumnExistsAsync(conn, "Profiles", "Status", "ALTER TABLE Profiles ADD COLUMN Status TEXT DEFAULT 'ready'");
        await EnsureColumnExistsAsync(conn, "Profiles", "Message", "ALTER TABLE Profiles ADD COLUMN Message TEXT DEFAULT ''");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS ProxyTypes (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Value TEXT NOT NULL UNIQUE,
                Label TEXT NOT NULL,
                DisplayOrder INTEGER NOT NULL DEFAULT 0
            )");

        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS InstalledBrowsers (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                BrowserType TEXT NOT NULL,
                BrowserVersion TEXT NOT NULL,
                InstallPath TEXT NOT NULL,
                ExecutablePath TEXT NOT NULL,
                InstalledAt TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(BrowserType, BrowserVersion)
            )");

        // Settings table for application settings (AutoCheckSchedule, etc.)
        await RunNonQueryAsync(conn, @"
            CREATE TABLE IF NOT EXISTS Settings (
                Key TEXT PRIMARY KEY,
                Value TEXT NOT NULL,
                UpdatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )");

        await SeedProxyTypesAsync(conn);
    }

    private static async Task SeedProxyTypesAsync(SqliteConnection conn)
    {
        await using var checkCmd = conn.CreateCommand();
        checkCmd.CommandText = "SELECT COUNT(*) FROM ProxyTypes";
        var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
        if (count > 0) return;

        var types = new[]
        {
            ("http",   "HTTP",      1),
            ("https",  "HTTPS",     2),
            ("socks4", "SOCKS4",    3),
            ("socks5", "SOCKS5",    4),
        };

        foreach (var (value, label, order) in types)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "INSERT OR IGNORE INTO ProxyTypes (Value, Label, DisplayOrder) VALUES (@v, @l, @o)";
            cmd.Parameters.AddWithValue("@v", value);
            cmd.Parameters.AddWithValue("@l", label);
            cmd.Parameters.AddWithValue("@o", order);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private static async Task RunNonQueryAsync(SqliteConnection conn, string sql)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task EnsureColumnExistsAsync(SqliteConnection conn, string tableName, string columnName, string alterSql)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info({tableName})";

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(reader.GetOrdinal("name")), columnName, StringComparison.OrdinalIgnoreCase))
                return;
        }

        await reader.DisposeAsync();
        await RunNonQueryAsync(conn, alterSql);
    }

    public void Dispose() { }
}
