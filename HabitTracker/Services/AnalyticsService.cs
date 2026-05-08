using HabitTracker.Data;
using HabitTracker.Models;
using HabitTracker.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class AnalyticsService(ApplicationDbContext dbContext) : IAnalyticsService
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

        var weeklyCompleted = CountCompletedRecords(habits, weekStart, today);
        var weeklyPossible = totalHabits * WeekLength;

        var monthlyCompleted = CountCompletedRecords(habits, monthStart, today);
        var monthlyPossible = totalHabits * MonthLength;
        var weeklyActivity = BuildWeeklyActivity(habits, weekStart, today);

        var performances = habits
            .Select(habit =>
            {
                var completed = habit.Records
                    .Where(record => record.IsCompleted && record.Date >= monthStart && record.Date <= today)
                    .Select(record => record.Date)
                    .Distinct()
                    .Count();

                return new HabitPerformanceViewModel
                {
                    HabitId = habit.Id,
                    Title = habit.Title,
                    CompletedDays = completed,
                    TrackedDays = MonthLength,
                    CompletionPercentage = CalculatePercentage(completed, MonthLength)
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
            DailyCompletionPercentage = CalculatePercentage(completedToday, totalHabits),
            WeeklyCompletedRecords = weeklyCompleted,
            WeeklyPossibleRecords = weeklyPossible,
            WeeklyCompletionPercentage = CalculatePercentage(weeklyCompleted, weeklyPossible),
            MonthlyCompletedRecords = monthlyCompleted,
            MonthlyPossibleRecords = monthlyPossible,
            MonthlyCompletionPercentage = CalculatePercentage(monthlyCompleted, monthlyPossible),
            CurrentStreak = CalculateCurrentStreak(habits, today),
            BestHabit = performances.FirstOrDefault(),
            WeakHabit = performances.OrderBy(item => item.CompletionPercentage).ThenBy(item => item.Title).FirstOrDefault(),
            WeeklyInsight = BuildWeeklyInsight(weeklyActivity),
            MonthlyInsight = BuildMonthlyInsight(CalculatePercentage(monthlyCompleted, monthlyPossible)),
            WeeklyActivity = weeklyActivity,
            HabitPerformances = performances
        };
    }

    private static bool HasCompletedRecord(Habit habit, DateOnly date)
    {
        return habit.Records.Any(record => record.Date == date && record.IsCompleted);
    }

    private static int CountCompletedRecords(IEnumerable<Habit> habits, DateOnly from, DateOnly to)
    {
        return habits.Sum(habit => habit.Records
            .Where(record => record.IsCompleted && record.Date >= from && record.Date <= to)
            .Select(record => record.Date)
            .Distinct()
            .Count());
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

    private static int CalculatePercentage(int completed, int total)
    {
        return total == 0
            ? 0
            : (int)Math.Round((double)completed / total * 100);
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
