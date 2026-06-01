namespace DuckGo.Models.Events;

public record ProfileCreatedEvent(int ProfileId, string ProfileName);
public record ProfileDeletedEvent(int ProfileId);
public record ProfileStartedEvent(int ProfileId);
public record ProfileStoppedEvent(int ProfileId);
