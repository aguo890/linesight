$ErrorActionPreference = "Stop"

Write-Host "Starting LineSight Development Environment..." -ForegroundColor Cyan

$root = $PSScriptRoot
$backendPath = Join-Path $root "..\backend"
$frontendPath = Join-Path $root "..\frontend"

# Check directories
if (-not (Test-Path $backendPath)) {
    Write-Error "Backend directory not found at $backendPath"
}
if (-not (Test-Path $frontendPath)) {
    Write-Error "Frontend directory not found at $frontendPath"
}

# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d ""$backendPath"" && venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -WorkingDirectory $backendPath

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d ""$frontendPath"" && npm run dev" -WorkingDirectory $frontendPath

Write-Host "Services started!" -ForegroundColor Cyan
