using HabitTracker.Models;
using HabitTracker.ViewModels;

namespace HabitTracker.Services;

public interface IHabitService
{
    Task<HabitIndexViewModel> GetIndexAsync(int userId, string? searchTerm, int? categoryId);

    Task<HabitDetailsViewModel?> GetDetailsAsync(int userId, int habitId);

    Task<HabitFormViewModel> CreateFormAsync();

    Task<HabitFormViewModel?> EditFormAsync(int userId, int habitId);

    Task<int> CreateAsync(int userId, HabitFormViewModel model);

    Task<bool> UpdateAsync(int userId, HabitFormViewModel model);

    Task<bool> ArchiveAsync(int userId, int habitId);

    Task<List<HabitCategory>> GetCategoriesAsync();

    Task<DashboardViewModel> GetDashboardAsync(int userId, string username);
}
