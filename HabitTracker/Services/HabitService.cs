using HabitTracker.Data;
using HabitTracker.Models;
using HabitTracker.ViewModels;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class HabitService(ApplicationDbContext dbContext) : IHabitService
{
    public async Task<HabitIndexViewModel> GetIndexAsync(int userId, string? searchTerm, int? categoryId)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var query = dbContext.Habits
            .AsNoTracking()
            .Include(habit => habit.Category)
            .Include(habit => habit.Records)
            .Where(habit => habit.UserId == userId && !habit.IsArchived);

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var normalizedSearch = searchTerm.Trim();
            query = query.Where(habit =>
                habit.Title.Contains(normalizedSearch) ||
                (habit.Description != null && habit.Description.Contains(normalizedSearch)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(habit => habit.HabitCategoryId == categoryId.Value);
        }

        var habits = await query
            .OrderByDescending(habit => habit.Priority)
            .ThenBy(habit => habit.Title)
            .Select(habit => new HabitListItemViewModel
            {
                Id = habit.Id,
                Title = habit.Title,
                Description = habit.Description,
                CategoryName = habit.Category != null ? habit.Category.Name : null,
                CategoryColor = habit.Category != null ? habit.Category.Color : null,
                Frequency = habit.Frequency,
                Priority = habit.Priority,
                CreatedAt = habit.CreatedAt,
                IsCompletedToday = habit.Records.Any(record => record.Date == today && record.IsCompleted)
            })
            .ToListAsync();

        return new HabitIndexViewModel
        {
            SearchTerm = searchTerm,
            CategoryId = categoryId,
            Categories = await BuildCategorySelectListAsync(categoryId),
            Habits = habits
        };
    }

    public async Task<HabitDetailsViewModel?> GetDetailsAsync(int userId, int habitId)
    {
        return await dbContext.Habits
            .AsNoTracking()
            .Include(habit => habit.Category)
            .Where(habit => habit.Id == habitId && habit.UserId == userId && !habit.IsArchived)
            .Select(habit => new HabitDetailsViewModel
            {
                Id = habit.Id,
                Title = habit.Title,
                Description = habit.Description,
                CategoryName = habit.Category != null ? habit.Category.Name : null,
                CategoryColor = habit.Category != null ? habit.Category.Color : null,
                Frequency = habit.Frequency,
                Priority = habit.Priority,
                Color = habit.Color,
                Icon = habit.Icon,
                CreatedAt = habit.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<HabitFormViewModel> CreateFormAsync()
    {
        return new HabitFormViewModel
        {
            Categories = await BuildCategorySelectListAsync(null)
        };
    }

    public async Task<HabitFormViewModel?> EditFormAsync(int userId, int habitId)
    {
        var habit = await dbContext.Habits
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == habitId && item.UserId == userId && !item.IsArchived);

        if (habit is null)
        {
            return null;
        }

        return new HabitFormViewModel
        {
            Id = habit.Id,
            Title = habit.Title,
            Description = habit.Description,
            HabitCategoryId = habit.HabitCategoryId,
            Frequency = habit.Frequency,
            Priority = habit.Priority,
            Color = habit.Color,
            Icon = habit.Icon,
            Categories = await BuildCategorySelectListAsync(habit.HabitCategoryId)
        };
    }

    public async Task<int> CreateAsync(int userId, HabitFormViewModel model)
    {
        var habit = new Habit
        {
            UserId = userId,
            Title = model.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(model.Description) ? null : model.Description.Trim(),
            HabitCategoryId = model.HabitCategoryId,
            Frequency = model.Frequency,
            Priority = model.Priority,
            Color = string.IsNullOrWhiteSpace(model.Color) ? null : model.Color.Trim(),
            Icon = string.IsNullOrWhiteSpace(model.Icon) ? null : model.Icon.Trim()
        };

        dbContext.Habits.Add(habit);
        await dbContext.SaveChangesAsync();

        return habit.Id;
    }

    public async Task<bool> UpdateAsync(int userId, HabitFormViewModel model)
    {
        if (!model.Id.HasValue)
        {
            return false;
        }

        var habit = await dbContext.Habits
            .FirstOrDefaultAsync(item => item.Id == model.Id.Value && item.UserId == userId && !item.IsArchived);

        if (habit is null)
        {
            return false;
        }

        habit.Title = model.Title.Trim();
        habit.Description = string.IsNullOrWhiteSpace(model.Description) ? null : model.Description.Trim();
        habit.HabitCategoryId = model.HabitCategoryId;
        habit.Frequency = model.Frequency;
        habit.Priority = model.Priority;
        habit.Color = string.IsNullOrWhiteSpace(model.Color) ? null : model.Color.Trim();
        habit.Icon = string.IsNullOrWhiteSpace(model.Icon) ? null : model.Icon.Trim();

        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ArchiveAsync(int userId, int habitId)
    {
        var habit = await dbContext.Habits
            .FirstOrDefaultAsync(item => item.Id == habitId && item.UserId == userId && !item.IsArchived);

        if (habit is null)
        {
            return false;
        }

        habit.IsArchived = true;
        await dbContext.SaveChangesAsync();
        return true;
    }

    public Task<List<HabitCategory>> GetCategoriesAsync()
    {
        return dbContext.HabitCategories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .ToListAsync();
    }

    public async Task<DashboardViewModel> GetDashboardAsync(int userId, string username)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var completedDates = await dbContext.HabitRecords
            .AsNoTracking()
            .Where(record =>
                record.IsCompleted &&
                record.Habit != null &&
                record.Habit.UserId == userId &&
                !record.Habit.IsArchived)
            .Select(record => record.Date)
            .Distinct()
            .ToListAsync();

        var habits = await dbContext.Habits
            .AsNoTracking()
            .Include(habit => habit.Category)
            .Include(habit => habit.Records)
            .Where(habit => habit.UserId == userId && !habit.IsArchived)
            .OrderByDescending(habit => habit.Priority)
            .ThenBy(habit => habit.Title)
            .Select(habit => new HabitListItemViewModel
            {
                Id = habit.Id,
                Title = habit.Title,
                Description = habit.Description,
                CategoryName = habit.Category != null ? habit.Category.Name : null,
                CategoryColor = habit.Category != null ? habit.Category.Color : null,
                Frequency = habit.Frequency,
                Priority = habit.Priority,
                CreatedAt = habit.CreatedAt,
                IsCompletedToday = habit.Records.Any(record => record.Date == today && record.IsCompleted)
            })
            .ToListAsync();

        return new DashboardViewModel
        {
            Username = username,
            Today = today,
            TotalHabits = habits.Count,
            CompletedToday = habits.Count(habit => habit.IsCompletedToday),
            CurrentStreak = CalculateCurrentStreak(completedDates, today),
            Habits = habits
        };
    }

    private static int CalculateCurrentStreak(IEnumerable<DateOnly> completedDates, DateOnly today)
    {
        var dates = completedDates.ToHashSet();
        var streak = 0;
        var cursor = today;

        while (dates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        return streak;
    }

    private async Task<List<SelectListItem>> BuildCategorySelectListAsync(int? selectedCategoryId)
    {
        var categories = await GetCategoriesAsync();
        var items = new List<SelectListItem>
        {
            new() { Value = string.Empty, Text = "Без категорії", Selected = selectedCategoryId is null }
        };

        items.AddRange(categories.Select(category => new SelectListItem
        {
            Value = category.Id.ToString(),
            Text = category.Name,
            Selected = category.Id == selectedCategoryId
        }));

        return items;
    }
}
