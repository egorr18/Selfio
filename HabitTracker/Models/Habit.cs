using System.ComponentModel.DataAnnotations;

namespace HabitTracker.Models;

public class Habit : BaseEntity
{
    private readonly List<HabitRecord> _records = [];

    [Required]
    public int UserId { get; set; }

    public User? User { get; set; }

    public int? HabitCategoryId { get; set; }

    public HabitCategory? Category { get; set; }

    [Required(ErrorMessage = "Habit title is required.")]
    [StringLength(100, MinimumLength = 2)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    [Required]
    public HabitFrequency Frequency { get; set; } = HabitFrequency.Daily;

    [Required]
    public HabitPriority Priority { get; set; } = HabitPriority.Medium;

    [StringLength(20)]
    public string? Color { get; set; }

    [StringLength(40)]
    public string? Icon { get; set; }

    public bool IsArchived { get; set; }

    public IReadOnlyCollection<HabitRecord> Records => _records.AsReadOnly();

    public bool IsCompletedOn(DateOnly date)
    {
        return _records.Any(record => record.Date == date && record.IsCompleted);
    }

    public void MarkCompleted(DateOnly date, string? note = null)
    {
        var existingRecord = _records.FirstOrDefault(record => record.Date == date);

        if (existingRecord is null)
        {
            _records.Add(new HabitRecord
            {
                Habit = this,
                Date = date,
                IsCompleted = true,
                Note = note
            });

            UpdatedAt = DateTime.UtcNow;
            return;
        }

        existingRecord.MarkCompleted(note);
        UpdatedAt = DateTime.UtcNow;
    }

    public void CancelCompletion(DateOnly date)
    {
        var existingRecord = _records.FirstOrDefault(record => record.Date == date);

        if (existingRecord is null)
        {
            return;
        }

        existingRecord.Cancel();
        UpdatedAt = DateTime.UtcNow;
    }
}
