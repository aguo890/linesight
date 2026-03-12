# dev_local.ps1 - Single-terminal native dev environment with combined logs
# Usage: .\dev_local.ps1  OR  make dev-local
#
# Configuration is loaded from .env (not session variables).
# The backend reads .env automatically via pydantic-settings.

# ── Ensure PATH is fresh ──
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ";" + [System.Environment]::GetEnvironmentVariable('Path','User')

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$envFile     = Join-Path $projectRoot ".env"

# ── Verify .env exists ──
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env file not found at $envFile" -ForegroundColor Red
    Write-Host "        Copy .env.docker.example to .env and configure for local use." -ForegroundColor Red
    exit 1
}

# ── 0. Kill stale processes on required ports ──
Write-Host "[cleanup]  Freeing ports 8000 and 5173..." -ForegroundColor DarkGray
$staleProcs = cmd /c "netstat -aon 2>nul" | Select-String ":8000 |:5173 " | ForEach-Object {
    if ($_ -match '\s(\d+)\s*$') { $Matches[1] }
} | Sort-Object -Unique
foreach ($pid in $staleProcs) {
    if ($pid -and $pid -ne "0") {
        cmd /c "taskkill /F /PID $pid 2>nul" | Out-Null
        Write-Host "[cleanup]  Killed PID $pid" -ForegroundColor Red
    }
}
Start-Sleep -Seconds 1

# ── 1. PostgreSQL ──
$pgData = "$env:USERPROFILE\scoop\apps\postgresql\current\data"
$pgReady = pg_isready 2>&1
if ($pgReady -match "accepting") {
    Write-Host "[postgres] Already running" -ForegroundColor Green
} else {
    Write-Host "[postgres] Starting..." -ForegroundColor Yellow
    pg_ctl start -D $pgData -l "$pgData\server.log"
    Start-Sleep -Seconds 2
}

# Ensure linesight DB exists
$dbCheck = psql -U postgres -lqt 2>&1 | Select-String "linesight"
if (-not $dbCheck) {
    Write-Host "[postgres] Creating linesight database..." -ForegroundColor Yellow
    createdb -U postgres linesight
    Write-Host "[postgres] Database 'linesight' created." -ForegroundColor Green
} else {
    Write-Host "[postgres] Database 'linesight' exists" -ForegroundColor Green
}

# Run Alembic migrations to ensure schema is up to date
Write-Host "[migrate]  Running Alembic migrations..." -ForegroundColor Yellow
$env:DB_HOST = "localhost"
$alembicExe = Join-Path $backendDir "venv\Scripts\alembic.exe"
Push-Location $backendDir
& $alembicExe upgrade head
Pop-Location
Write-Host "[migrate]  Migrations complete." -ForegroundColor Green

# ── 2. Redis (visible in log stream, not hidden) ──
$redisRunning = Get-Process redis-server -ErrorAction SilentlyContinue
if ($redisRunning) {
    Write-Host "[redis]    Already running" -ForegroundColor Green
} else {
    Write-Host "[redis]    Starting..." -ForegroundColor Yellow
}

# ── 3. Backend venv check ──
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "[backend]  Creating venv..." -ForegroundColor Yellow
    Push-Location $backendDir
    python -m venv venv
    & $venvPython -m pip install -r requirements.txt
    Pop-Location
}

# ── 4. Launch all services ──
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LineSight Native Dev Environment"      -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Config   -> .env"                      -ForegroundColor DarkGray
Write-Host "  Backend  -> http://localhost:8000"      -ForegroundColor White
Write-Host "  Frontend -> http://localhost:5173"      -ForegroundColor White
Write-Host "  Press Ctrl+C to stop all services"     -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$uvicornExe = Join-Path $backendDir "venv\Scripts\uvicorn.exe"

# Log files for tailing
$backendLog     = Join-Path $projectRoot ".backend.log"
$backendErrLog  = Join-Path $projectRoot ".backend.err.log"
$frontendLog    = Join-Path $projectRoot ".frontend.log"
$frontendErrLog = Join-Path $projectRoot ".frontend.err.log"
$redisLog       = Join-Path $projectRoot ".redis.log"
$redisErrLog    = Join-Path $projectRoot ".redis.err.log"

# Clear old log files
foreach ($f in @($backendLog, $backendErrLog, $frontendLog, $frontendErrLog, $redisLog, $redisErrLog)) {
    "" | Set-Content $f
}

# Start Redis if not already running (with visible logs)
$redisProc = $null
if (-not (Get-Process redis-server -ErrorAction SilentlyContinue)) {
    $redisProc = Start-Process -NoNewWindow -PassThru -FilePath "redis-server" `
        -RedirectStandardOutput $redisLog `
        -RedirectStandardError $redisErrLog
}

# Start backend — env vars are loaded from .env by pydantic-settings automatically
# We only need to set DB_HOST so it overrides the Docker default of "postgres"
$env:DB_HOST = "localhost"

$backendProc = Start-Process -NoNewWindow -PassThru -FilePath $uvicornExe `
    -ArgumentList "app.main:app --reload --host 0.0.0.0 --port 8000" `
    -WorkingDirectory $backendDir `
    -RedirectStandardOutput $backendLog `
    -RedirectStandardError $backendErrLog

# Start frontend
$frontendProc = Start-Process -NoNewWindow -PassThru -FilePath "npm.cmd" `
    -ArgumentList "run dev" `
    -WorkingDirectory $frontendDir `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError $frontendErrLog

# ── 5. Tail all log files until Ctrl+C ──
# Use arrays instead of hashtables to avoid "Collection was modified" error
$logConfigs = @(
    @{ Path=$backendLog;     Label="backend "; Color="Yellow";   Pos=0 },
    @{ Path=$backendErrLog;  Label="backend "; Color="Yellow";   Pos=0 },
    @{ Path=$frontendLog;    Label="frontend"; Color="Magenta";  Pos=0 },
    @{ Path=$frontendErrLog; Label="frontend"; Color="Magenta";  Pos=0 },
    @{ Path=$redisLog;       Label="redis   "; Color="DarkCyan"; Pos=0 },
    @{ Path=$redisErrLog;    Label="redis   "; Color="DarkCyan"; Pos=0 }
)

try {
    while ($true) {
        for ($i = 0; $i -lt $logConfigs.Count; $i++) {
            $cfg = $logConfigs[$i]
            if (Test-Path $cfg.Path) {
                $content = Get-Content $cfg.Path -Raw -ErrorAction SilentlyContinue
                if ($content -and $content.Length -gt $cfg.Pos) {
                    $newContent = $content.Substring($cfg.Pos)
                    $logConfigs[$i].Pos = $content.Length
                    foreach ($line in ($newContent -split "`n")) {
                        $line = $line.Trim()
                        if ($line) {
                            Write-Host "[$($cfg.Label)] $line" -ForegroundColor $cfg.Color
                        }
                    }
                }
            }
        }

        # Health check
        if ($backendProc.HasExited -and $frontendProc.HasExited) {
            Write-Host "Both services stopped." -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Red
    if (-not $backendProc.HasExited)  { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
    if (-not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    if ($redisProc -and -not $redisProc.HasExited) { Stop-Process -Id $redisProc.Id -Force -ErrorAction SilentlyContinue }
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "Done. (Postgres still running in background)" -ForegroundColor DarkGray
}
