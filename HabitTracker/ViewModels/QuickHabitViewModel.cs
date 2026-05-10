using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;

namespace HabitTracker.ViewModels;

public class QuickHabitViewModel
{
    [Required(ErrorMessage = "Введи назву звички.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Назва має містити від 2 до 100 символів.")]
    public string Title { get; set; } = string.Empty;

    public int? HabitCategoryId { get; set; }

    public HabitPriority Priority { get; set; } = HabitPriority.Medium;

    [StringLength(20)]
    public string? Color { get; set; }

    [StringLength(40)]
    public string? Icon { get; set; }
}
