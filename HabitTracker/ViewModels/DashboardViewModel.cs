namespace HabitTracker.ViewModels;

public class DashboardViewModel
{
    public string Username { get; set; } = string.Empty;

    public DateOnly Today { get; set; }

    public int TotalHabits { get; set; }

    public int CompletedToday { get; set; }

    public int NotCompletedToday => Math.Max(0, TotalHabits - CompletedToday);

    public int CompletionPercentage => TotalHabits == 0
        ? 0
        : (int)Math.Round((double)CompletedToday / TotalHabits * 100);

    public int CurrentStreak { get; set; }

    public List<HabitListItemViewModel> Habits { get; set; } = [];
}
