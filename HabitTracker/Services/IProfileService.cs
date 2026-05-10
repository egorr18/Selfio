using HabitTracker.ViewModels;

namespace HabitTracker.Services;

public interface IProfileService
{
    Task<ProfileViewModel?> GetProfileAsync(int userId);
}
