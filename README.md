# HabitTracker

HabitTracker is an ASP.NET Core MVC course project for tracking and analyzing user habits.

## Tech Stack

- C#
- .NET 8
- ASP.NET Core MVC
- Entity Framework Core
- SQLite
- Cookie authentication
- Bootstrap

## Features

- User registration
- User login and logout
- Password hashing
- Protected Dashboard, Habits, and Analytics pages
- Habit CRUD
- Habit categories
- Search and filtering
- Mark habit as completed today
- Cancel today's completion
- Dashboard with daily progress and streak
- Analytics with daily, weekly, monthly statistics, best habit, and weak habit

## Run Locally

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

## Database

The project uses SQLite. The local database file is ignored by git.

Create or update the database:

```powershell
$env:PATH = 'C:\Program Files\dotnet;' + $env:PATH
dotnet ef database update --project HabitTracker\HabitTracker.csproj --startup-project HabitTracker\HabitTracker.csproj
```

## Project Structure

```text
HabitTracker/
  Controllers/
  Data/
  Models/
  Services/
  ViewModels/
  Views/
  wwwroot/
  Migrations/
```

## GitHub Pages Note

GitHub Pages cannot run ASP.NET Core MVC. This project must be run locally with `dotnet run` or deployed to a .NET hosting service.
