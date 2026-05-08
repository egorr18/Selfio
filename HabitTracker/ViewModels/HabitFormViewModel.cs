using System.ComponentModel.DataAnnotations;
using HabitTracker.Models;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace HabitTracker.ViewModels;

public class HabitFormViewModel
{
    public int? Id { get; set; }

    [Required(ErrorMessage = "Назва звички обов'язкова.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Назва має містити від 2 до 100 символів.")]
    public string Title { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Опис не може перевищувати 500 символів.")]
    public string? Description { get; set; }

    public int? HabitCategoryId { get; set; }

    [Required]
    public HabitFrequency Frequency { get; set; } = HabitFrequency.Daily;

    [Required]
    public HabitPriority Priority { get; set; } = HabitPriority.Medium;

    [StringLength(20)]
    public string? Color { get; set; }

    [StringLength(40)]
    public string? Icon { get; set; }

    public List<SelectListItem> Categories { get; set; } = [];
}
