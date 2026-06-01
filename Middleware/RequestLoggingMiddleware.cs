namespace DuckGo.Middleware;

public class RequestLoggingMiddleware
{
    private readonly Action<string, string, TimeSpan> _log;

    public RequestLoggingMiddleware(Action<string, string, TimeSpan> log)
    {
        _log = log;
    }

    public T Intercept<T>(string action, Func<T> func) where T : class
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var result = func();
            sw.Stop();
            _log(action, "OK", sw.Elapsed);
            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log(action, $"ERROR: {ex.Message}", sw.Elapsed);
            throw;
        }
    }

    public async Task<T> InterceptAsync<T>(string action, Func<Task<T>> func) where T : class
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var result = await func();
            sw.Stop();
            _log(action, "OK", sw.Elapsed);
            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _log(action, $"ERROR: {ex.Message}", sw.Elapsed);
            throw;
        }
    }
}
