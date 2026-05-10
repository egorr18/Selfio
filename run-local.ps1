$dotnet = "C:\Program Files\dotnet\dotnet.exe"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectExe = Join-Path $projectRoot "HabitTracker\bin\Debug\net8.0\HabitTracker.exe"

if (-not (Test-Path $dotnet)) {
    Write-Error ".NET SDK was not found at $dotnet. Install .NET 8 SDK or add dotnet to PATH."
    exit 1
}

$runningApp = Get-Process HabitTracker -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $projectExe }

if ($runningApp) {
    Write-Host "Stopping previous HabitTracker instance..."
    $runningApp | Stop-Process -Force
    Start-Sleep -Seconds 1
}

& $dotnet run --project .\HabitTracker\HabitTracker.csproj --urls http://localhost:5188
