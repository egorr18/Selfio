namespace HabitTracker.ViewModels;

public class DashboardViewModel
{
    public string Username { get; set; } = string.Empty;

    public DateOnly Today { get; set; }

    public int TotalHabits { get; set; }

    public int CompletedToday { get; set; }

    public int NotCompletedToday => Math.Max(0, TotalHabits - CompletedToday);

    public int CompletionPercentage => TotalHabits == 0
        ? 0
        : (int)Math.Round((double)CompletedToday / TotalHabits * 100);

    public int CurrentStreak { get; set; }

    public int ConsistencyScore => Math.Min(100, (CompletionPercentage + Math.Min(CurrentStreak * 8, 40)) / 2);

    public int ExperiencePoints => CompletedToday * 15 + CurrentStreak * 10;

    public int Level => Math.Max(1, ExperiencePoints / 100 + 1);

    public string FocusMessage
    {
        get
        {
            if (TotalHabits == 0)
            {
                return "Почни з однієї маленької звички. Найкращий трекер той, який не заважає діяти.";
            }

            if (CompletionPercentage == 100)
            {
                return "Ідеальний день закрито. Збережи темп і не ускладнюй систему.";
            }

            if (CompletionPercentage >= 60)
            {
                return $"Гарний ритм. Залишилось {NotCompletedToday} звичок до повного дня.";
            }

            return "Вибери одну найпростішу дію і закрий її зараз. Малий прогрес теж рахується.";
        }
    }

    public List<HabitListItemViewModel> Habits { get; set; } = [];
}
