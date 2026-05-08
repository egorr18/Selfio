using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Models;

public class HabitRecord : BaseEntity
{
    [Required]
    public int HabitId { get; set; }

    public Habit? Habit { get; set; }

    [Required]
    public DateOnly Date { get; set; }

    public bool IsCompleted { get; set; }

    [StringLength(300)]
    public string? Note { get; set; }

    public void MarkCompleted(string? note = null)
    {
        IsCompleted = true;
        Note = note;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        IsCompleted = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
