# Load necessary paths
$env:PATH = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ";" + [System.Environment]::GetEnvironmentVariable('Path', 'User')

Write-Host "Starting local databases..."
# Initialize Postgres DB if it doesn't exist
$pgDataPath = "$env:USERPROFILE\scoop\apps\postgresql\current\data"
if (-Not (Test-Path "$pgDataPath")) {
    Write-Host "Initializing Postgres database..."
    initdb -D "$pgDataPath"
}
# Start Postgres
pg_ctl start -D "$pgDataPath"

# Create Database if it doesn't exist
try {
    # Check if DB exists, if not create it
    $dbExists = psql -U postgres -lqt | Select-String "linesight"
    if (-not $dbExists) {
        Write-Host "Creating linesight database..."
        createdb -U postgres linesight
        
        # In case the application uses a specific user
        # psql -c "CREATE USER postgres WITH SUPERUSER PASSWORD 'password';"
    }
} catch {
    Write-Host "Failed to create database check psql"
}

# Launch Redis silently
Start-Process "redis-server" -WindowStyle Hidden

Write-Host "Provisioning Python backend..."
cd "C:\Users\aguo890\Desktop\Projects\linesight\backend"
python -m venv venv
# Use full path to pip and python within venv just to be safe
.\venv\Scripts\python.exe -m pip install -r requirements.txt
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:APP_NAME="LineSight"
$env:REDIS_URL="redis://localhost:6379/0"
$env:DB_USER="postgres"
$env:DB_NAME="linesight"

Start-Process -NoNewWindow -FilePath ".\venv\Scripts\uvicorn.exe" -ArgumentList "app.main:app --reload --port 8000"

Write-Host "Provisioning Node frontend..."
cd "C:\Users\aguo890\Desktop\Projects\linesight\frontend"
npm install --legacy-peer-deps
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run dev"

Write-Host "Application stack successfully orchestrated natively."
