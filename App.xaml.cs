using System;
using System.Windows;

namespace DuckGo;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            var ex = args.ExceptionObject as Exception;
            System.Diagnostics.Debug.WriteLine($"[DuckGo] UNHANDLED DOMAIN EXCEPTION: {ex}");
            MessageBox.Show($"Unhandled exception:\n{ex?.Message}\n\n{ex?.StackTrace}", "DuckGo Error", MessageBoxButton.OK, MessageBoxImage.Error);
        };

        DispatcherUnhandledException += (s, args) =>
        {
            System.Diagnostics.Debug.WriteLine($"[DuckGo] UNHANDLED UI EXCEPTION: {args.Exception}");
            MessageBox.Show($"UI exception:\n{args.Exception.Message}\n\n{args.Exception.StackTrace}", "DuckGo Error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };

        TaskScheduler.UnobservedTaskException += (s, args) =>
        {
            System.Diagnostics.Debug.WriteLine($"[DuckGo] UNOBSERVED TASK EXCEPTION: {args.Exception}");
            args.SetObserved();
        };

        var mainWindow = new MainWindow();
        mainWindow.Show();
    }
}
