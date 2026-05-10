namespace HabitTracker.ViewModels;

public class HabitHeatmapDayViewModel
{
    public DateOnly Date { get; set; }

    public bool IsCompleted { get; set; }

    public bool IsToday { get; set; }

    public string? Note { get; set; }

    public string Label => Date.ToString("dd.MM");
}
