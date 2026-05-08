using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Models;

public class HabitCategory : BaseEntity
{
    [Required]
    [StringLength(60)]
    public string Name { get; set; } = string.Empty;

    [StringLength(20)]
    public string? Color { get; set; }

    public ICollection<Habit> Habits { get; set; } = new List<Habit>();
}
