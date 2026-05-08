namespace HabitTracker.ViewModels;

public class HabitPerformanceViewModel
{
    public int HabitId { get; set; }

    public string Title { get; set; } = string.Empty;

    public int CompletedDays { get; set; }

    public int TrackedDays { get; set; }

    public int CompletionPercentage { get; set; }
}
