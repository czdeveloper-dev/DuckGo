using System.IO;
using Microsoft.Data.Sqlite;
using DuckGo.Models.DTOs;

namespace DuckGo.Data.Repositories;

public interface IInstalledBrowserRepository
{
    Task<InstalledBrowser?> GetByTypeAndVersionAsync(string browserType, string browserVersion);
    Task<List<InstalledBrowser>> GetAllAsync();
    Task<int> UpsertAsync(InstalledBrowser browser);
    Task DeleteAsync(int id);
    Task DeleteByTypeAndVersionAsync(string browserType, string browserVersion);
}

public class InstalledBrowserRepository : IInstalledBrowserRepository
{
    private readonly DatabaseService _db;

    public InstalledBrowserRepository(DatabaseService db)
    {
        _db = db;
    }

    public async Task<InstalledBrowser?> GetByTypeAndVersionAsync(string browserType, string browserVersion)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT Id, BrowserType, BrowserVersion, InstallPath, ExecutablePath, InstalledAt
                            FROM InstalledBrowsers
                            WHERE BrowserType = @type AND BrowserVersion = @version";
        cmd.Parameters.AddWithValue("@type", browserType);
        cmd.Parameters.AddWithValue("@version", browserVersion);

        await using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            return ReadBrowser(reader);
        }
        return null;
    }

    public async Task<List<InstalledBrowser>> GetAllAsync()
    {
        var list = new List<InstalledBrowser>();
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"SELECT Id, BrowserType, BrowserVersion, InstallPath, ExecutablePath, InstalledAt
                            FROM InstalledBrowsers";

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            list.Add(ReadBrowser(reader));
        }
        return list;
    }

    public async Task<int> UpsertAsync(InstalledBrowser browser)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"INSERT INTO InstalledBrowsers (BrowserType, BrowserVersion, InstallPath, ExecutablePath, InstalledAt)
                            VALUES (@type, @version, @installPath, @exePath, @installedAt)
                            ON CONFLICT(BrowserType, BrowserVersion) DO UPDATE SET
                                InstallPath = @installPath,
                                ExecutablePath = @exePath,
                                InstalledAt = @installedAt";
        cmd.Parameters.AddWithValue("@type", browser.BrowserType);
        cmd.Parameters.AddWithValue("@version", browser.BrowserVersion);
        cmd.Parameters.AddWithValue("@installPath", browser.InstallPath);
        cmd.Parameters.AddWithValue("@exePath", browser.ExecutablePath);
        cmd.Parameters.AddWithValue("@installedAt", browser.InstalledAt.ToString("o"));

        return await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(int id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM InstalledBrowsers WHERE Id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteByTypeAndVersionAsync(string browserType, string browserVersion)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM InstalledBrowsers WHERE BrowserType = @type AND BrowserVersion = @version";
        cmd.Parameters.AddWithValue("@type", browserType);
        cmd.Parameters.AddWithValue("@version", browserVersion);
        await cmd.ExecuteNonQueryAsync();
    }

    private static InstalledBrowser ReadBrowser(SqliteDataReader reader)
    {
        return new InstalledBrowser
        {
            Id = reader.GetInt32(0),
            BrowserType = reader.GetString(1),
            BrowserVersion = reader.GetString(2),
            InstallPath = reader.GetString(3),
            ExecutablePath = reader.GetString(4),
            InstalledAt = DateTime.Parse(reader.GetString(5))
        };
    }
}
