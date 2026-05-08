using HabitTracker.Models;

namespace HabitTracker.Services;

public record AuthResult(bool Succeeded, User? User, string? ErrorMessage)
{
    public static AuthResult Success(User user) => new(true, user, null);

    public static AuthResult Failure(string errorMessage) => new(false, null, errorMessage);
}
