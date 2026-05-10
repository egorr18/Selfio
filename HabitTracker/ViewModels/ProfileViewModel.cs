namespace HabitTracker.ViewModels;

public class ProfileViewModel
{
    public string Username { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int ActiveHabits { get; set; }

    public int ArchivedHabits { get; set; }

    public int TotalHabits { get; set; }

    public int CompletedRecords { get; set; }

    public int CategoriesCount { get; set; }

    public int CompletionRate { get; set; }

    public int CurrentStreak { get; set; }

    public string? BestHabitTitle { get; set; }

    public int? BestHabitPercentage { get; set; }

    public string? WeakHabitTitle { get; set; }

    public int? WeakHabitPercentage { get; set; }
}
