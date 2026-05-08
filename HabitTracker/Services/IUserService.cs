using HabitTracker.ViewModels;

namespace HabitTracker.Services;

public interface IUserService
{
    Task<AuthResult> RegisterAsync(RegisterViewModel model);

    Task<AuthResult> LoginAsync(LoginViewModel model);
}
