using HabitTracker.Services;
using HabitTracker.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers;

[Authorize]
public class ProfileController(
    IProfileService profileService,
    IUserService userService,
    ICurrentUserService currentUserService) : Controller
{
    public async Task<IActionResult> Index()
    {
        var userId = currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");
        var profile = await profileService.GetProfileAsync(userId);

        if (profile is null)
        {
            return NotFound();
        }

        return View(profile);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
    {
        if (!ModelState.IsValid)
        {
            TempData["SecurityError"] = "Перевір поля форми: пароль має містити щонайменше 6 символів, а підтвердження має збігатися.";
            return RedirectToAction(nameof(Index), new { tab = "security" });
        }

        var userId = currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");
        var result = await userService.ChangePasswordAsync(userId, model);

        if (!result.Succeeded)
        {
            TempData["SecurityError"] = result.ErrorMessage ?? "Не вдалося змінити пароль.";
            return RedirectToAction(nameof(Index), new { tab = "security" });
        }

        TempData["SecuritySuccess"] = "Пароль успішно змінено.";
        return RedirectToAction(nameof(Index), new { tab = "security" });
    }
}
