using HabitTracker.Services;
using HabitTracker.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace HabitTracker.Controllers;

[Authorize]
public class DashboardController(
    IHabitService habitService,
    ICurrentUserService currentUserService) : Controller
{
    public async Task<IActionResult> Index()
    {
        var userId = currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");
        var model = await habitService.GetDashboardAsync(userId, currentUserService.Username ?? "User");

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> QuickAdd([Bind(Prefix = "QuickHabit")] QuickHabitViewModel quickHabit)
    {
        var userId = currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");

        if (!ModelState.IsValid)
        {
            var model = await habitService.GetDashboardAsync(userId, currentUserService.Username ?? "User");
            model.QuickHabit = quickHabit;
            return View(nameof(Index), model);
        }

        await habitService.CreateAsync(userId, new HabitFormViewModel
        {
            Title = quickHabit.Title,
            HabitCategoryId = quickHabit.HabitCategoryId,
            Priority = quickHabit.Priority,
            Color = string.IsNullOrWhiteSpace(quickHabit.Color) ? "#45c49a" : quickHabit.Color,
            Icon = string.IsNullOrWhiteSpace(quickHabit.Icon) ? "✓" : quickHabit.Icon
        });

        return RedirectToAction(nameof(Index));
    }
}
