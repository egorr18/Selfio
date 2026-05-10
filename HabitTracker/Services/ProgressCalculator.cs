using HabitTracker.Models;

namespace HabitTracker.Services;

public class ProgressCalculator : IProgressCalculator
{
    private const int DaysInWeek = 7;

    public int CountExpectedOccurrences(Habit habit, DateOnly from, DateOnly to)
    {
        if (to < from)
        {
            return 0;
        }

        var days = to.DayNumber - from.DayNumber + 1;

        return habit.Frequency switch
        {
            HabitFrequency.Weekly => Math.Max(1, (int)Math.Ceiling(days / (double)DaysInWeek)),
            _ => days
        };
    }

    public int CountCompletedOccurrences(Habit habit, DateOnly from, DateOnly to)
    {
        var completedDates = habit.Records
            .Where(record => record.IsCompleted && record.Date >= from && record.Date <= to)
            .Select(record => record.Date)
            .Distinct()
            .ToList();

        var completed = habit.Frequency switch
        {
            HabitFrequency.Weekly => completedDates
                .Select(date => (date.DayNumber - from.DayNumber) / DaysInWeek)
                .Distinct()
                .Count(),
            _ => completedDates.Count
        };

        return Math.Min(completed, CountExpectedOccurrences(habit, from, to));
    }

    public int CalculatePercentage(int completed, int expected)
    {
        return expected == 0
            ? 0
            : (int)Math.Round((double)completed / expected * 100);
    }

    public int CalculateStreak(IEnumerable<DateOnly> completedDates, DateOnly today)
    {
        var dates = completedDates.ToHashSet();
        var streak = 0;
        var cursor = today;

        while (dates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        return streak;
    }

    public int CalculateStreak(Habit habit, DateOnly today)
    {
        if (habit.Frequency != HabitFrequency.Weekly)
        {
            return CalculateStreak(GetCompletedDates(habit), today);
        }

        var completedDates = GetCompletedDates(habit);
        var streak = 0;
        var cursor = today;

        while (HasCompletedInPeriod(completedDates, cursor.AddDays(-(DaysInWeek - 1)), cursor))
        {
            streak++;
            cursor = cursor.AddDays(-DaysInWeek);
        }

        return streak;
    }

    public bool IsSatisfiedForDate(Habit habit, DateOnly date)
    {
        if (habit.Frequency != HabitFrequency.Weekly)
        {
            return HasCompletedRecord(habit, date);
        }

        return HasCompletedInPeriod(GetCompletedDates(habit), date.AddDays(-(DaysInWeek - 1)), date);
    }

    private static List<DateOnly> GetCompletedDates(Habit habit)
    {
        return habit.Records
            .Where(record => record.IsCompleted)
            .Select(record => record.Date)
            .Distinct()
            .ToList();
    }

    private static bool HasCompletedRecord(Habit habit, DateOnly date)
    {
        return habit.Records.Any(record => record.IsCompleted && record.Date == date);
    }

    private static bool HasCompletedInPeriod(IEnumerable<DateOnly> completedDates, DateOnly from, DateOnly to)
    {
        return completedDates.Any(date => date >= from && date <= to);
    }
}
