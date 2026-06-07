using System.Text.Json;
using DuckGo.Models.DTOs;

namespace DuckGo.Services;

public class ToastService
{
    private readonly Action<ToastPayload> _onToast;

    public ToastService(Action<ToastPayload> onToast)
    {
        _onToast = onToast;
    }

    public void ShowInfo(string title, string message)
        => _onToast(ToastPayload.Info(title, message));

    public void ShowSuccess(string title, string message)
        => _onToast(ToastPayload.Success(title, message));

    public void ShowError(string title, string message)
        => _onToast(ToastPayload.Error(title, message));

    public void ShowProgress(string toastId, string title, string message, int progress, string status)
        => _onToast(ToastPayload.Progress(toastId, title, message, progress, status));

    public void CompleteProgress(string toastId, string title, string message)
        => _onToast(ToastPayload.Complete(toastId, title, message));

    public void FailProgress(string toastId, string title, string message)
        => _onToast(ToastPayload.Failed(toastId, title, message));
}
