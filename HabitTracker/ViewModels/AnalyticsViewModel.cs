namespace HabitTracker.ViewModels;

public class AnalyticsViewModel
{
    public DateOnly Today { get; set; }

    public int TotalHabits { get; set; }

    public int CompletedToday { get; set; }

    public int DailyCompletionPercentage { get; set; }

    public int WeeklyCompletedRecords { get; set; }

    public int WeeklyPossibleRecords { get; set; }

    public int WeeklyCompletionPercentage { get; set; }

    public int MonthlyCompletedRecords { get; set; }

    public int MonthlyPossibleRecords { get; set; }

    public int MonthlyCompletionPercentage { get; set; }

    public int CurrentStreak { get; set; }

    public HabitPerformanceViewModel? BestHabit { get; set; }

    public HabitPerformanceViewModel? WeakHabit { get; set; }

    public string WeeklyInsight { get; set; } = string.Empty;

    public string MonthlyInsight { get; set; } = string.Empty;

    public List<WeeklyActivityViewModel> WeeklyActivity { get; set; } = [];

    public List<HabitPerformanceViewModel> HabitPerformances { get; set; } = [];
}
