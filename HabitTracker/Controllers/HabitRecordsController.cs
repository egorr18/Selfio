using HabitTracker.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HabitTracker.Controllers;

[Authorize]
public class HabitRecordsController(
    IHabitRecordService habitRecordService,
    ICurrentUserService currentUserService) : Controller
{
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CompleteToday(int habitId, string? note = null, string? returnUrl = null)
    {
        var handled = await habitRecordService.MarkCompletedTodayAsync(GetRequiredUserId(), habitId, note);
        if (!handled)
        {
            return NotFound();
        }

        return RedirectBack(returnUrl);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CancelToday(int habitId, string? returnUrl = null)
    {
        var handled = await habitRecordService.CancelCompletionTodayAsync(GetRequiredUserId(), habitId);
        if (!handled)
        {
            return NotFound();
        }

        return RedirectBack(returnUrl);
    }

    private int GetRequiredUserId()
    {
        return currentUserService.UserId ?? throw new InvalidOperationException("Authenticated user id is missing.");
    }

    private IActionResult RedirectBack(string? returnUrl)
    {
        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return Redirect(returnUrl);
        }

        return RedirectToAction("Index", "Dashboard");
    }
}
