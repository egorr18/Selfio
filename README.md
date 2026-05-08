# Selfio / HabitTracker

This repository now contains two related parts:

1. The original static Selfio prototype: HTML/CSS/JavaScript pages used as a UI/UX prototype.
2. The new C# course project: `HabitTracker`, built with ASP.NET Core MVC, EF Core, and SQLite.

## Run HabitTracker Locally

Use PowerShell from the repository root:

```powershell
.\run-local.ps1
```

Or run directly:

```powershell
& 'C:\Program Files\dotnet\dotnet.exe' run --project HabitTracker\HabitTracker.csproj --urls http://localhost:5188
```

Then open:

```text
http://localhost:5188
```

## HabitTracker Stack

- C#
- .NET 8
- ASP.NET Core MVC
- Entity Framework Core
- SQLite
- Cookie authentication

## Implemented HabitTracker Features

- User registration
- User login/logout
- Password hashing
- Protected Dashboard, Habits, Analytics pages
- Habit CRUD
- Habit categories
- Search and filtering
- Mark habit as completed today
- Cancel today's completion
- Dashboard with daily progress and streak
- Analytics with daily, weekly, monthly statistics, best habit, and weak habit

## Database

The project uses SQLite. The local database file is ignored by git.

To create/update the database:

```powershell
$env:PATH = 'C:\Program Files\dotnet;' + $env:PATH
dotnet ef database update --project HabitTracker\HabitTracker.csproj --startup-project HabitTracker\HabitTracker.csproj
```

## GitHub Pages Note

GitHub Pages can run only static files. The old Selfio prototype can be viewed through GitHub Pages, but the new ASP.NET Core MVC HabitTracker must be run through `dotnet run` or deployed to a .NET hosting service.
