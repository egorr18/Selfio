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
}
