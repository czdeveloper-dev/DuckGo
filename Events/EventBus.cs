namespace DuckGo.Events;

public interface IEventBus
{
    void Subscribe<TEvent>(Action<TEvent> handler) where TEvent : class;
    void Unsubscribe<TEvent>(Action<TEvent> handler) where TEvent : class;
    void Publish<TEvent>(TEvent @event) where TEvent : class;
}

public class EventBus : IEventBus
{
    private readonly Dictionary<Type, List<Delegate>> _handlers = new();

    public void Subscribe<TEvent>(Action<TEvent> handler) where TEvent : class
    {
        var type = typeof(TEvent);
        if (!_handlers.ContainsKey(type))
            _handlers[type] = new List<Delegate>();
        _handlers[type].Add(handler);
    }

    public void Unsubscribe<TEvent>(Action<TEvent> handler) where TEvent : class
    {
        var type = typeof(TEvent);
        if (_handlers.TryGetValue(type, out var handlers))
            handlers.Remove(handler);
    }

    public void Publish<TEvent>(TEvent @event) where TEvent : class
    {
        var type = typeof(TEvent);
        if (_handlers.TryGetValue(type, out var handlers))
            foreach (var handler in handlers.ToList())
                ((Action<TEvent>)handler)(@event);
    }
}
