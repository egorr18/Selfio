using HabitTracker.Data;
using HabitTracker.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class ProfileService(
    ApplicationDbContext dbContext,
    IAnalyticsService analyticsService) : IProfileService
{
    public async Task<ProfileViewModel?> GetProfileAsync(int userId)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == userId);

        if (user is null)
        {
            return null;
        }

        var analytics = await analyticsService.GetAnalyticsAsync(userId);
        var totalHabits = await dbContext.Habits
            .AsNoTracking()
            .CountAsync(habit => habit.UserId == userId);

        var activeHabits = await dbContext.Habits
            .AsNoTracking()
            .CountAsync(habit => habit.UserId == userId && !habit.IsArchived);

        var archivedHabits = totalHabits - activeHabits;
        var categoriesCount = await dbContext.HabitCategories
            .AsNoTracking()
            .CountAsync();

        var completedRecords = await dbContext.HabitRecords
            .AsNoTracking()
            .CountAsync(record =>
                record.IsCompleted &&
                record.Habit != null &&
                record.Habit.UserId == userId &&
                !record.Habit.IsArchived);

        return new ProfileViewModel
        {
            Username = user.Username,
            Email = user.Email,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            ActiveHabits = activeHabits,
            ArchivedHabits = archivedHabits,
            TotalHabits = totalHabits,
            CompletedRecords = completedRecords,
            CategoriesCount = categoriesCount,
            CompletionRate = analytics.MonthlyCompletionPercentage,
            CurrentStreak = analytics.CurrentStreak,
            BestHabitTitle = analytics.BestHabit?.Title,
            BestHabitPercentage = analytics.BestHabit?.CompletionPercentage,
            WeakHabitTitle = analytics.WeakHabit?.Title,
            WeakHabitPercentage = analytics.WeakHabit?.CompletionPercentage
        };
    }
}
