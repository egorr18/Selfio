namespace HabitTracker.Services;

public interface ICurrentUserService
{
    int? UserId { get; }

    string? Username { get; }
}
