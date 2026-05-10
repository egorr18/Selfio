using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class HabitRecordService(ApplicationDbContext dbContext) : IHabitRecordService
{
    public async Task<bool> MarkCompletedTodayAsync(int userId, int habitId, string? note = null)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var habit = await dbContext.Habits
            .Include(item => item.Records)
            .FirstOrDefaultAsync(item => item.Id == habitId && item.UserId == userId && !item.IsArchived);

        if (habit is null)
        {
            return false;
        }

        var existingRecord = habit.Records.FirstOrDefault(record => record.Date == today);
        if (existingRecord is not null)
        {
            existingRecord.MarkCompleted(NormalizeNote(note));
        }
        else
        {
            dbContext.HabitRecords.Add(new HabitRecord
            {
                HabitId = habit.Id,
                Date = today,
                IsCompleted = true,
                Note = NormalizeNote(note)
            });
        }

        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelCompletionTodayAsync(int userId, int habitId)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var record = await dbContext.HabitRecords
            .Include(item => item.Habit)
            .FirstOrDefaultAsync(item =>
                item.HabitId == habitId &&
                item.Date == today &&
                item.Habit != null &&
                item.Habit.UserId == userId &&
                !item.Habit.IsArchived);

        if (record is null)
        {
            return false;
        }

        record.Cancel();
        await dbContext.SaveChangesAsync();
        return true;
    }

    private static string? NormalizeNote(string? note)
    {
        if (string.IsNullOrWhiteSpace(note))
        {
            return null;
        }

        return note.Trim();
    }
}
