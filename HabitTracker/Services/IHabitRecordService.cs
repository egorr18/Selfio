namespace HabitTracker.Services;

public interface IHabitRecordService
{
    Task<bool> MarkCompletedTodayAsync(int userId, int habitId);

    Task<bool> CancelCompletionTodayAsync(int userId, int habitId);
}
