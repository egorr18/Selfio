using HabitTracker.Services;
using HabitTracker.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers;

[Authorize]
public class HabitsController(
    IHabitService habitService,
    ICurrentUserService currentUserService) : Controller
{
    public async Task<IActionResult> Index(string? searchTerm, int? categoryId)
    {
        var userId = GetRequiredUserId();
        var model = await habitService.GetIndexAsync(userId, searchTerm, categoryId);
        return View(model);
    }

    public async Task<IActionResult> Details(int id)
    {
        var userId = GetRequiredUserId();
        var habit = await habitService.GetDetailsAsync(userId, id);

        if (habit is null)
        {
            return NotFound();
        }

        return View(habit);
    }

    [HttpGet]
    public async Task<IActionResult> Create()
    {
        var model = await habitService.CreateFormAsync();
        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(HabitFormViewModel model)
    {
        if (!ModelState.IsValid)
        {
            model.Categories = (await habitService.CreateFormAsync()).Categories;
            return View(model);
        }

        var habitId = await habitService.CreateAsync(GetRequiredUserId(), model);
        return RedirectToAction(nameof(Details), new { id = habitId });
    }

    [HttpGet]
    public async Task<IActionResult> Edit(int id)
    {
        var userId = GetRequiredUserId();
        var model = await habitService.EditFormAsync(userId, id);

        if (model is null)
        {
            return NotFound();
        }

        return View(model);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, HabitFormViewModel model)
    {
        if (model.Id != id)
        {
            return BadRequest();
        }

        if (!ModelState.IsValid)
        {
            var form = await habitService.EditFormAsync(GetRequiredUserId(), id);
            model.Categories = form?.Categories ?? [];
            return View(model);
        }

        var updated = await habitService.UpdateAsync(GetRequiredUserId(), model);
        if (!updated)
        {
            return NotFound();
        }

        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpGet]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetRequiredUserId();
        var habit = await habitService.GetDetailsAsync(userId, id);

        if (habit is null)
        {
            return NotFound();
        }

        return View(habit);
    }

    [HttpPost]
    [ActionName("Delete")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteConfirmed(int id)
    {
        var deleted = await habitService.ArchiveAsync(GetRequiredUserId(), id);
        if (!deleted)
        {
            return NotFound();
        }

        return RedirectToAction(nameof(Index));
    }

    private int GetRequiredUserId()
    {
        return currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");
    }
}
