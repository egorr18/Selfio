using HabitTracker.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
}
