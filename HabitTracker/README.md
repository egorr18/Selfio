# HabitTracker

HabitTracker is an ASP.NET Core MVC course project for tracking and analyzing user habits.

## Tech Stack

- C#
- .NET 8
- ASP.NET Core MVC
- Entity Framework Core
- SQLite
- Cookie authentication

## Run Locally

From the repository root:

```powershell
.\run-local.ps1
```

Or run directly:

```powershell
& 'C:\Program Files\dotnet\dotnet.exe' run --project HabitTracker\HabitTracker.csproj --urls http://localhost:5188
```

Open:

```text
http://localhost:5188
```

## Database

The project uses SQLite. Create or update the database with:

```powershell
$env:PATH = 'C:\Program Files\dotnet;' + $env:PATH
dotnet ef database update --project HabitTracker\HabitTracker.csproj --startup-project HabitTracker\HabitTracker.csproj
```

The local `habittracker.db` file is ignored by git.

## Implemented Features

- Register, login, logout
- Password hashing
- Protected pages
- Habit CRUD
- Categories
- Search/filter
- Complete/cancel today's habit record
- Dashboard
- Analytics: daily, weekly, monthly progress, streak, best habit, weak habit

## Note About GitHub Pages

GitHub Pages can host only static HTML/CSS/JS. The ASP.NET Core MVC version must be run locally with `dotnet run` or deployed to a .NET hosting platform.
