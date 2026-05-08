namespace HabitTracker.ViewModels;

public class WeeklyActivityViewModel
{
    public DateOnly Date { get; set; }

    public string DayLabel { get; set; } = string.Empty;

    public int Completed { get; set; }

    public int Total { get; set; }

    public int Percentage => Total == 0
        ? 0
        : (int)Math.Round((double)Completed / Total * 100);
}
