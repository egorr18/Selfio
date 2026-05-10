using HabitTracker.Models;

namespace HabitTracker.ViewModels;

public class HabitDetailsViewModel
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? CategoryName { get; set; }

    public string? CategoryColor { get; set; }

    public HabitFrequency Frequency { get; set; }

    public HabitPriority Priority { get; set; }

    public string? Color { get; set; }

    public string? Icon { get; set; }

    public DateTime CreatedAt { get; set; }

    public bool IsCompletedToday { get; set; }

    public string? TodayNote { get; set; }

    public int CurrentStreak { get; set; }

    public int CompletedLast30Days { get; set; }

    public int ExpectedLast30Days { get; set; }

    public int MonthlyCompletionPercentage { get; set; }

    public List<HabitHeatmapDayViewModel> HeatmapDays { get; set; } = [];
}
