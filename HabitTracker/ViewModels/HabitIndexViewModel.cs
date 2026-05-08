using Microsoft.AspNetCore.Mvc.Rendering;

namespace HabitTracker.ViewModels;

public class HabitIndexViewModel
{
    public string? SearchTerm { get; set; }

    public int? CategoryId { get; set; }

    public List<SelectListItem> Categories { get; set; } = [];

    public List<HabitListItemViewModel> Habits { get; set; } = [];
}
