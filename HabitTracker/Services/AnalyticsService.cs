using HabitTracker.Data;
using HabitTracker.Models;
using HabitTracker.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class AnalyticsService(
    ApplicationDbContext dbContext,
    IProgressCalculator progressCalculator) : IAnalyticsService
{
    private const int WeekLength = 7;
    private const int MonthLength = 30;

    public async Task<AnalyticsViewModel> GetAnalyticsAsync(int userId)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var weekStart = today.AddDays(-(WeekLength - 1));
        var monthStart = today.AddDays(-(MonthLength - 1));

        var habits = await dbContext.Habits
            .AsNoTracking()
            .Include(habit => habit.Records)
            .Where(habit => habit.UserId == userId && !habit.IsArchived)
            .ToListAsync();

        var totalHabits = habits.Count;
        var completedToday = habits.Count(habit => HasCompletedRecord(habit, today));

        var weeklyCompleted = CountCompletedOccurrences(habits, weekStart, today);
        var weeklyPossible = CountExpectedOccurrences(habits, weekStart, today);

        var monthlyCompleted = CountCompletedOccurrences(habits, monthStart, today);
        var monthlyPossible = CountExpectedOccurrences(habits, monthStart, today);
        var weeklyActivity = BuildWeeklyActivity(habits, weekStart, today);

        var performances = habits
            .Select(habit =>
            {
                var completed = progressCalculator.CountCompletedOccurrences(habit, monthStart, today);
                var expected = progressCalculator.CountExpectedOccurrences(habit, monthStart, today);

                return new HabitPerformanceViewModel
                {
                    HabitId = habit.Id,
                    Title = habit.Title,
                    CompletedDays = completed,
                    TrackedDays = expected,
                    CompletionPercentage = progressCalculator.CalculatePercentage(completed, expected)
                };
            })
            .OrderByDescending(item => item.CompletionPercentage)
            .ThenBy(item => item.Title)
            .ToList();

        return new AnalyticsViewModel
        {
            Today = today,
            TotalHabits = totalHabits,
            CompletedToday = completedToday,
            DailyCompletionPercentage = progressCalculator.CalculatePercentage(completedToday, totalHabits),
            WeeklyCompletedRecords = weeklyCompleted,
            WeeklyPossibleRecords = weeklyPossible,
            WeeklyCompletionPercentage = progressCalculator.CalculatePercentage(weeklyCompleted, weeklyPossible),
            MonthlyCompletedRecords = monthlyCompleted,
            MonthlyPossibleRecords = monthlyPossible,
            MonthlyCompletionPercentage = progressCalculator.CalculatePercentage(monthlyCompleted, monthlyPossible),
            CurrentStreak = CalculateCurrentStreak(habits, today),
            BestHabit = performances.FirstOrDefault(),
            WeakHabit = performances.OrderBy(item => item.CompletionPercentage).ThenBy(item => item.Title).FirstOrDefault(),
            WeeklyInsight = BuildWeeklyInsight(weeklyActivity),
            MonthlyInsight = BuildMonthlyInsight(progressCalculator.CalculatePercentage(monthlyCompleted, monthlyPossible)),
            WeeklyActivity = weeklyActivity,
            HabitPerformances = performances
        };
    }

    private static bool HasCompletedRecord(Habit habit, DateOnly date)
    {
        return habit.Records.Any(record => record.Date == date && record.IsCompleted);
    }

    private int CountCompletedOccurrences(IEnumerable<Habit> habits, DateOnly from, DateOnly to)
    {
        return habits.Sum(habit => progressCalculator.CountCompletedOccurrences(habit, from, to));
    }

    private int CountExpectedOccurrences(IEnumerable<Habit> habits, DateOnly from, DateOnly to)
    {
        return habits.Sum(habit => progressCalculator.CountExpectedOccurrences(habit, from, to));
    }

    private static int CalculateCurrentStreak(List<Habit> habits, DateOnly today)
    {
        if (habits.Count == 0)
        {
            return 0;
        }

        var completedDates = habits
            .SelectMany(habit => habit.Records)
            .Where(record => record.IsCompleted)
            .Select(record => record.Date)
            .Distinct()
            .ToHashSet();

        var streak = 0;
        var cursor = today;

        while (completedDates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        return streak;
    }

    private static List<WeeklyActivityViewModel> BuildWeeklyActivity(List<Habit> habits, DateOnly from, DateOnly to)
    {
        var days = new List<WeeklyActivityViewModel>();

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var completed = habits.Count(habit => HasCompletedRecord(habit, date));

            days.Add(new WeeklyActivityViewModel
            {
                Date = date,
                DayLabel = date.ToString("ddd"),
                Completed = completed,
                Total = habits.Count
            });
        }

        return days;
    }

    private static string BuildWeeklyInsight(List<WeeklyActivityViewModel> weeklyActivity)
    {
        if (weeklyActivity.Count == 0 || weeklyActivity.All(day => day.Total == 0))
        {
            return "Додай першу звичку, щоб побачити тижневий ритм.";
        }

        var bestDay = weeklyActivity.OrderByDescending(day => day.Percentage).First();
        var weakDay = weeklyActivity.OrderBy(day => day.Percentage).First();

        return $"Найсильніший день тижня: {bestDay.Date:dd.MM} ({bestDay.Percentage}%). Найслабший: {weakDay.Date:dd.MM} ({weakDay.Percentage}%).";
    }

    private static string BuildMonthlyInsight(int monthlyPercentage)
    {
        return monthlyPercentage switch
        {
            >= 80 => "Місячна стабільність висока. Можна обережно додати нову маленьку звичку.",
            >= 50 => "Є робочий ритм. Сфокусуйся на одній слабкій звичці, а не на всіх одразу.",
            > 0 => "Початок уже є. Спростити звички краще, ніж кинути їх повністю.",
            _ => "За місяць ще немає виконань. Почни з дії, яку можна зробити за 2 хвилини."
        };
    }
}
