# Stop all native processes started by run_native.ps1
Write-Host "Stopping backend, frontend, and redis..."
Stop-Process -Name "uvicorn", "python", "node", "redis-server" -Force -ErrorAction SilentlyContinue

Write-Host "Stopping PostgreSQL database..."
$pgDataPath = "$env:USERPROFILE\scoop\apps\postgresql\current\data"
if (Test-Path "$pgDataPath") {
    pg_ctl stop -D "$pgDataPath"
}

Write-Host "All background processes stopped successfully."
