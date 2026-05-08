using HabitTracker.Data;
using HabitTracker.Models;
using HabitTracker.ViewModels;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HabitTracker.Services;

public class UserService(
    ApplicationDbContext dbContext,
    IPasswordHasher<User> passwordHasher) : IUserService
{
    public async Task<AuthResult> RegisterAsync(RegisterViewModel model)
    {
        var email = NormalizeEmail(model.Email);
        var username = model.Username.Trim();

        var emailExists = await dbContext.Users.AnyAsync(user => user.Email == email);
        if (emailExists)
        {
            return AuthResult.Failure("A user with this email already exists.");
        }

        var usernameExists = await dbContext.Users.AnyAsync(user => user.Username == username);
        if (usernameExists)
        {
            return AuthResult.Failure("A user with this username already exists.");
        }

        var user = new User
        {
            Username = username,
            Email = email
        };

        user.PasswordHash = passwordHasher.HashPassword(user, model.Password);

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        return AuthResult.Success(user);
    }

    public async Task<AuthResult> LoginAsync(LoginViewModel model)
    {
        var email = NormalizeEmail(model.Email);
        var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Email == email);

        if (user is null)
        {
            return AuthResult.Failure("Invalid email or password.");
        }

        var verificationResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, model.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return AuthResult.Failure("Invalid email or password.");
        }

        return AuthResult.Success(user);
    }

    private static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }
}
