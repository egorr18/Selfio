using HabitTracker.ViewModels;

namespace HabitTracker.Services;

public interface IAnalyticsService
{
    Task<AnalyticsViewModel> GetAnalyticsAsync(int userId);
}
