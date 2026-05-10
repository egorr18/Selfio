using System.ComponentModel.DataAnnotations;

namespace HabitTracker.ViewModels;

public class ChangePasswordViewModel
{
    [Required(ErrorMessage = "Поточний пароль обов'язковий.")]
    [DataType(DataType.Password)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Новий пароль обов'язковий.")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Пароль має містити щонайменше 6 символів.")]
    [DataType(DataType.Password)]
    public string NewPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Підтвердження пароля обов'язкове.")]
    [Compare(nameof(NewPassword), ErrorMessage = "Паролі не збігаються.")]
    [DataType(DataType.Password)]
    public string ConfirmPassword { get; set; } = string.Empty;
}
