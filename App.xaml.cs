using System.Windows;

namespace DuckGo;

public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var db = new Data.DatabaseService();
        await db.InitializeAsync();

        var mainWindow = new MainWindow();
        mainWindow.Show();
    }
}
