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
            .Where(habit => habit.UserId == userId)
            .OrderBy(habit => habit.IsArchived)
            .ThenByDescending(habit => habit.Priority)
            .ThenBy(habit => habit.Title)
            .ToListAsync();

        using var workbook = new XLWorkbook();

        AddSummarySheet(workbook, user, habits, periodTitle, startDate, endDate);
        AddHabitsSheet(workbook, habits, startDate, endDate);
        AddRecordsSheet(workbook, habits, startDate, endDate);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var fileName = $"habittracker-{periodKey}-{DateTime.Now:yyyyMMdd-HHmm}.xlsx";
        return new ExcelExportResult(stream.ToArray(), fileName);
    }

    private static void AddSummarySheet(
        XLWorkbook workbook,
        User user,
        IReadOnlyCollection<Habit> habits,
        string periodTitle,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Summary");
        var records = habits.SelectMany(habit => habit.Records)
            .Where(record => record.Date >= startDate && record.Date <= endDate)
            .ToList();

        var completedRecords = records.Count(record => record.IsCompleted);
        var activeHabits = habits.Count(habit => !habit.IsArchived);

        worksheet.Cell(1, 1).Value = "HabitTracker export";
        worksheet.Cell(1, 1).Style.Font.Bold = true;
        worksheet.Cell(1, 1).Style.Font.FontSize = 16;

        worksheet.Cell(3, 1).Value = "User";
        worksheet.Cell(3, 2).Value = user.Username;
        worksheet.Cell(4, 1).Value = "Email";
        worksheet.Cell(4, 2).Value = user.Email;
        worksheet.Cell(5, 1).Value = "Period";
        worksheet.Cell(5, 2).Value = periodTitle;
        worksheet.Cell(6, 1).Value = "Date range";
        worksheet.Cell(6, 2).Value = $"{startDate:dd.MM.yyyy} - {endDate:dd.MM.yyyy}";
        worksheet.Cell(7, 1).Value = "Active habits";
        worksheet.Cell(7, 2).Value = activeHabits;
        worksheet.Cell(8, 1).Value = "All habits";
        worksheet.Cell(8, 2).Value = habits.Count;
        worksheet.Cell(9, 1).Value = "Completed records";
        worksheet.Cell(9, 2).Value = completedRecords;
        worksheet.Cell(10, 1).Value = "Exported at";
        worksheet.Cell(10, 2).Value = DateTime.Now;
        worksheet.Cell(10, 2).Style.DateFormat.Format = "dd.MM.yyyy HH:mm";

        FormatKeyValueSheet(worksheet);
    }

    private static void AddHabitsSheet(
        XLWorkbook workbook,
        IReadOnlyCollection<Habit> habits,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Habits");
        var headers = new[]
        {
            "Id",
            "Title",
            "Description",
            "Category",
            "Frequency",
            "Priority",
            "Color",
            "Icon",
            "Archived",
            "Created",
            "Completed in period",
            "Completion rate"
        };

        WriteHeaders(worksheet, headers);

        var periodDays = Math.Max(1, endDate.DayNumber - startDate.DayNumber + 1);
        var row = 2;

        foreach (var habit in habits)
        {
            var completedInPeriod = habit.Records.Count(record =>
                record.IsCompleted &&
                record.Date >= startDate &&
                record.Date <= endDate);
            var completionRate = Math.Round((double)completedInPeriod / periodDays, 2);

            worksheet.Cell(row, 1).Value = habit.Id;
            worksheet.Cell(row, 2).Value = habit.Title;
            worksheet.Cell(row, 3).Value = habit.Description ?? string.Empty;
            worksheet.Cell(row, 4).Value = habit.Category?.Name ?? "Без категорії";
            worksheet.Cell(row, 5).Value = habit.Frequency.ToString();
            worksheet.Cell(row, 6).Value = habit.Priority.ToString();
            worksheet.Cell(row, 7).Value = habit.Color ?? string.Empty;
            worksheet.Cell(row, 8).Value = habit.Icon ?? string.Empty;
            worksheet.Cell(row, 9).Value = habit.IsArchived ? "Так" : "Ні";
            worksheet.Cell(row, 10).Value = habit.CreatedAt.ToLocalTime();
            worksheet.Cell(row, 10).Style.DateFormat.Format = "dd.MM.yyyy";
            worksheet.Cell(row, 11).Value = completedInPeriod;
            worksheet.Cell(row, 12).Value = completionRate;
            worksheet.Cell(row, 12).Style.NumberFormat.Format = "0%";

            row++;
        }

        FormatTableSheet(worksheet, headers.Length, row - 1);
    }

    private static void AddRecordsSheet(
        XLWorkbook workbook,
        IReadOnlyCollection<Habit> habits,
        DateOnly startDate,
        DateOnly endDate)
    {
        var worksheet = workbook.Worksheets.Add("Records");
        var headers = new[]
        {
            "Date",
            "Habit",
            "Category",
            "Completed",
            "Note"
        };

        WriteHeaders(worksheet, headers);

        var records = habits
            .SelectMany(habit => habit.Records.Select(record => new { Habit = habit, Record = record }))
            .Where(item => item.Record.Date >= startDate && item.Record.Date <= endDate)
            .OrderByDescending(item => item.Record.Date)
            .ThenBy(item => item.Habit.Title)
            .ToList();

        var row = 2;
        foreach (var item in records)
        {
            worksheet.Cell(row, 1).Value = item.Record.Date.ToDateTime(TimeOnly.MinValue);
            worksheet.Cell(row, 1).Style.DateFormat.Format = "dd.MM.yyyy";
            worksheet.Cell(row, 2).Value = item.Habit.Title;
            worksheet.Cell(row, 3).Value = item.Habit.Category?.Name ?? "Без категорії";
            worksheet.Cell(row, 4).Value = item.Record.IsCompleted ? "Так" : "Ні";
            worksheet.Cell(row, 5).Value = item.Record.Note ?? string.Empty;

            row++;
        }

        FormatTableSheet(worksheet, headers.Length, row - 1);
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

    private static void FormatKeyValueSheet(IXLWorksheet worksheet)
    {
        worksheet.Range(3, 1, 10, 1).Style.Font.Bold = true;
        worksheet.Range(3, 1, 10, 2).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        worksheet.Range(3, 1, 10, 2).Style.Border.InsideBorder = XLBorderStyleValues.Thin;
        worksheet.Columns().AdjustToContents();
    }
}
