using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Models;

public class User : BaseEntity
{
    private readonly List<Habit> _habits = [];

    [Required]
    [StringLength(40, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(120)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    public IReadOnlyCollection<Habit> Habits => _habits.AsReadOnly();
}
