using ClosedXML.Excel;
using HabitTracker.Data;
using HabitTracker.Models;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class ExcelExportService(ApplicationDbContext dbContext) : IExcelExportService
{
    public async Task<ExcelExportResult> ExportHabitsAsync(int userId, string period)
    {
        var (periodKey, periodTitle, startDate, endDate) = ResolvePeriod(period);

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstAsync(item => item.Id == userId);

        var habits = await dbContext.Habits
            .AsNoTracking()
            .Include(habit => habit.Category)
            .Include(habit => habit.Records)
            .Where(habit => habit.UserId == userId && !habit.IsArchived)
            .OrderByDescending(habit => habit.Priority)
            .ThenBy(habit => habit.Title)
            .ToListAsync();

        using var workbook = new XLWorkbook();

        AddOverviewSheet(workbook, user, habits, periodTitle, startDate, endDate);
        AddDailyTrackerSheet(workbook, habits, startDate, endDate);
        AddHabitDetailsSheet(workbook, habits, startDate, endDate);
        AddHabitRecordsSheet(workbook, habits, startDate, endDate);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var fileName = $"habittracker-{periodKey}-{DateTime.Now:yyyyMMdd-HHmm}.xlsx";
        return new ExcelExportResult(stream.ToArray(), fileName);
    }

    private static void AddOverviewSheet(
        XLWorkbook workbook,
        User user,
        IReadOnlyCollection<Habit> habits,
        string periodTitle,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Overview");
        var totalPossible = CountPossibleDays(habits, startDate, endDate);
        var totalCompleted = CountCompletedDays(habits, startDate, endDate);
        var completionRate = totalPossible == 0 ? 0 : (double)totalCompleted / totalPossible;

        worksheet.Cell(1, 1).Value = "HabitTracker export";
        worksheet.Cell(1, 1).Style.Font.Bold = true;
        worksheet.Cell(1, 1).Style.Font.FontSize = 16;

        worksheet.Cell(3, 1).Value = "Користувач";
        worksheet.Cell(3, 2).Value = user.Username;
        worksheet.Cell(4, 1).Value = "Email";
        worksheet.Cell(4, 2).Value = user.Email;
        worksheet.Cell(5, 1).Value = "Період";
        worksheet.Cell(5, 2).Value = periodTitle;
        worksheet.Cell(6, 1).Value = "Діапазон дат";
        worksheet.Cell(6, 2).Value = $"{startDate:dd.MM.yyyy} - {endDate:dd.MM.yyyy}";
        worksheet.Cell(7, 1).Value = "Активні звички";
        worksheet.Cell(7, 2).Value = habits.Count;
        worksheet.Cell(8, 1).Value = "Виконано";
        worksheet.Cell(8, 2).Value = $"{totalCompleted}/{totalPossible}";
        worksheet.Cell(9, 1).Value = "% виконання";
        worksheet.Cell(9, 2).Value = completionRate;
        worksheet.Cell(9, 2).Style.NumberFormat.Format = "0%";
        worksheet.Cell(10, 1).Value = "Дата експорту";
        worksheet.Cell(10, 2).Value = DateTime.Now;
        worksheet.Cell(10, 2).Style.DateFormat.Format = "dd.MM.yyyy HH:mm";

        FormatKeyValueSheet(worksheet, 10);
    }

    private static void AddDailyTrackerSheet(
        XLWorkbook workbook,
        IReadOnlyList<Habit> habits,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Daily Tracker");
        var headers = new List<string> { "Дата" };
        headers.AddRange(habits.Select(habit => habit.Title));
        headers.Add("Усього виконано");
        headers.Add("% дня");

        WriteHeaders(worksheet, headers);

        var row = 2;
        foreach (var date in EachDateDescending(startDate, endDate))
        {
            worksheet.Cell(row, 1).Value = date.ToDateTime(TimeOnly.MinValue);
            worksheet.Cell(row, 1).Style.DateFormat.Format = "dd.MM.yyyy";

            var completed = 0;
            var possible = 0;

            for (var i = 0; i < habits.Count; i++)
            {
                var habit = habits[i];
                var cell = worksheet.Cell(row, i + 2);

                if (!IsHabitAvailableOn(habit, date))
                {
                    cell.Value = "-";
                    cell.Style.Font.FontColor = XLColor.Gray;
                    continue;
                }

                possible++;
                var isCompleted = IsCompletedOn(habit, date);
                if (isCompleted)
                {
                    completed++;
                }

                cell.Value = isCompleted ? "Так" : "Ні";
                cell.Style.Fill.BackgroundColor = isCompleted
                    ? XLColor.FromHtml("#d8f5e4")
                    : XLColor.FromHtml("#ffe3e3");
            }

            worksheet.Cell(row, habits.Count + 2).Value = $"{completed}/{possible}";
            worksheet.Cell(row, habits.Count + 3).Value = possible == 0 ? 0 : (double)completed / possible;
            worksheet.Cell(row, habits.Count + 3).Style.NumberFormat.Format = "0%";

            row++;
        }

        FormatTableSheet(worksheet, headers.Count, row - 1);
    }

    private static void AddHabitDetailsSheet(
        XLWorkbook workbook,
        IReadOnlyCollection<Habit> habits,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Habit Details");
        var headers = new[]
        {
            "Звичка",
            "Категорія",
            "Частота",
            "Пріоритет",
            "Виконано разів",
            "Пропущено разів",
            "% виконання",
            "Streak",
            "Опис"
        };

        WriteHeaders(worksheet, headers);

        var row = 2;
        foreach (var habit in habits)
        {
            var possible = CountPossibleDays(habit, startDate, endDate);
            var completed = CountCompletedDays(habit, startDate, endDate);
            var missed = Math.Max(0, possible - completed);
            var completionRate = possible == 0 ? 0 : (double)completed / possible;
            var streak = CalculateStreak(habit, endDate);

            worksheet.Cell(row, 1).Value = habit.Title;
            worksheet.Cell(row, 2).Value = habit.Category?.Name ?? "Без категорії";
            worksheet.Cell(row, 3).Value = habit.Frequency.ToString();
            worksheet.Cell(row, 4).Value = habit.Priority.ToString();
            worksheet.Cell(row, 5).Value = completed;
            worksheet.Cell(row, 6).Value = missed;
            worksheet.Cell(row, 7).Value = completionRate;
            worksheet.Cell(row, 7).Style.NumberFormat.Format = "0%";
            worksheet.Cell(row, 8).Value = streak;
            worksheet.Cell(row, 9).Value = habit.Description ?? string.Empty;

            row++;
        }

        FormatTableSheet(worksheet, headers.Length, row - 1);
    }

    private static void AddHabitRecordsSheet(
        XLWorkbook workbook,
        IReadOnlyList<Habit> habits,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Habit Records");
        var headers = new[]
        {
            "Дата",
            "Звичка",
            "Категорія",
            "Статус",
            "Нотатка"
        };

        WriteHeaders(worksheet, headers);

        var row = 2;
        foreach (var date in EachDateDescending(startDate, endDate))
        {
            foreach (var habit in habits.Where(habit => IsHabitAvailableOn(habit, date)))
            {
                var record = habit.Records.FirstOrDefault(item => item.Date == date);

                worksheet.Cell(row, 1).Value = date.ToDateTime(TimeOnly.MinValue);
                worksheet.Cell(row, 1).Style.DateFormat.Format = "dd.MM.yyyy";
                worksheet.Cell(row, 2).Value = habit.Title;
                worksheet.Cell(row, 3).Value = habit.Category?.Name ?? "Без категорії";
                worksheet.Cell(row, 4).Value = record?.IsCompleted == true ? "Так" : "Ні";
                worksheet.Cell(row, 5).Value = record?.Note ?? string.Empty;

                row++;
            }
        }

        FormatTableSheet(worksheet, headers.Length, row - 1);
    }

    private static bool IsHabitAvailableOn(Habit habit, DateOnly date)
    {
        return DateOnly.FromDateTime(habit.CreatedAt.ToLocalTime()) <= date;
    }

    private static bool IsCompletedOn(Habit habit, DateOnly date)
    {
        return habit.Records.Any(record => record.Date == date && record.IsCompleted);
    }

    private static int CountPossibleDays(IReadOnlyCollection<Habit> habits, DateOnly startDate, DateOnly endDate)
    {
        return habits.Sum(habit => CountPossibleDays(habit, startDate, endDate));
    }

    private static int CountPossibleDays(Habit habit, DateOnly startDate, DateOnly endDate)
    {
        return EachDateAscending(startDate, endDate).Count(date => IsHabitAvailableOn(habit, date));
    }

    private static int CountCompletedDays(IReadOnlyCollection<Habit> habits, DateOnly startDate, DateOnly endDate)
    {
        return habits.Sum(habit => CountCompletedDays(habit, startDate, endDate));
    }

    private static int CountCompletedDays(Habit habit, DateOnly startDate, DateOnly endDate)
    {
        return habit.Records.Count(record =>
            record.IsCompleted &&
            record.Date >= startDate &&
            record.Date <= endDate &&
            IsHabitAvailableOn(habit, record.Date));
    }

    private static int CalculateStreak(Habit habit, DateOnly endDate)
    {
        var streak = 0;
        var currentDate = endDate;

        while (IsHabitAvailableOn(habit, currentDate) && IsCompletedOn(habit, currentDate))
        {
            streak++;
            currentDate = currentDate.AddDays(-1);
        }

        return streak;
    }

    private static IEnumerable<DateOnly> EachDateAscending(DateOnly startDate, DateOnly endDate)
    {
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            yield return date;
        }
    }

    private static IEnumerable<DateOnly> EachDateDescending(DateOnly startDate, DateOnly endDate)
    {
        for (var date = endDate; date >= startDate; date = date.AddDays(-1))
        {
            yield return date;
        }
    }

    private static (string PeriodKey, string PeriodTitle, DateOnly StartDate, DateOnly EndDate) ResolvePeriod(string period)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);

        return period.Trim().ToLowerInvariant() switch
        {
            "day" => ("day", "1 день", today, today),
            "week" => ("week", "7 днів", today.AddDays(-6), today),
            "month" => ("month", "30 днів", today.AddDays(-29), today),
            _ => ("week", "7 днів", today.AddDays(-6), today)
        };
    }

    private static void WriteHeaders(IXLWorksheet worksheet, IReadOnlyList<string> headers)
    {
        for (var i = 0; i < headers.Count; i++)
        {
            worksheet.Cell(1, i + 1).Value = headers[i];
        }

        var range = worksheet.Range(1, 1, 1, headers.Count);
        range.Style.Font.Bold = true;
        range.Style.Fill.BackgroundColor = XLColor.FromHtml("#2f6f5e");
        range.Style.Font.FontColor = XLColor.White;
    }

    private static void FormatTableSheet(IXLWorksheet worksheet, int columnCount, int lastRow)
    {
        if (lastRow >= 1)
        {
            var range = worksheet.Range(1, 1, Math.Max(lastRow, 1), columnCount);
            range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        }

        worksheet.Columns().AdjustToContents();
        worksheet.SheetView.FreezeRows(1);
    }

    private static void FormatKeyValueSheet(IXLWorksheet worksheet, int lastRow)
    {
        worksheet.Range(3, 1, lastRow, 1).Style.Font.Bold = true;
        worksheet.Range(3, 1, lastRow, 2).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        worksheet.Range(3, 1, lastRow, 2).Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        worksheet.Columns().AdjustToContents();
    }
}
