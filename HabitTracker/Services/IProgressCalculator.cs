using HabitTracker.Models;

namespace HabitTracker.Services;

public interface IProgressCalculator
{
    int CountExpectedOccurrences(Habit habit, DateOnly from, DateOnly to);

    int CountCompletedOccurrences(Habit habit, DateOnly from, DateOnly to);

    int CalculatePercentage(int completed, int expected);

    int CalculateStreak(IEnumerable<DateOnly> completedDates, DateOnly today);

    int CalculateStreak(Habit habit, DateOnly today);

    bool IsSatisfiedForDate(Habit habit, DateOnly date);
}
