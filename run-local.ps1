$dotnet = "C:\Program Files\dotnet\dotnet.exe"

if (-not (Test-Path $dotnet)) {
    Write-Error ".NET SDK was not found at $dotnet. Install .NET 8 SDK or add dotnet to PATH."
    exit 1
}

& $dotnet run --project .\HabitTracker\HabitTracker.csproj --urls http://localhost:5188
