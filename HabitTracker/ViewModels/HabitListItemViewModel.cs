using HabitTracker.Models;

namespace HabitTracker.ViewModels;

public class HabitListItemViewModel
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? CategoryName { get; set; }

    public string? CategoryColor { get; set; }

    public HabitFrequency Frequency { get; set; }

    public HabitPriority Priority { get; set; }

    public DateTime CreatedAt { get; set; }

    public bool IsCompletedToday { get; set; }
}
