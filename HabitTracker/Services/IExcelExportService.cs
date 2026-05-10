namespace HabitTracker.Services;

public interface IExcelExportService
{
    Task<ExcelExportResult> ExportHabitsAsync(int userId, string period);
}
