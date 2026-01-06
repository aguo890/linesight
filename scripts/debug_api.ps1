# API Sanity Check Script
# Tests analytics endpoints directly and validates response shapes

$ErrorActionPreference = "Stop"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "   LineSight API Diagnostic Script   " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$API_BASE = "http://localhost:8000/api/v1"

# Try to get token from environment, or prompt
$TOKEN = $env:API_TOKEN
if (-not $TOKEN) {
    Write-Host "`n[!] No API_TOKEN environment variable set." -ForegroundColor Yellow
    Write-Host "    To set: `$env:API_TOKEN = 'your-jwt-token'" -ForegroundColor Gray
    Write-Host "    (Get token from browser DevTools > Application > localStorage > token)" -ForegroundColor Gray
    Write-Host "`nAttempting requests without auth (may fail with 401)..." -ForegroundColor Yellow
    $headers = @{}
} else {
    Write-Host "`n[+] Using API_TOKEN from environment" -ForegroundColor Green
    $headers = @{ "Authorization" = "Bearer $TOKEN" }
}

function Test-Endpoint {
    param(
        [string]$Endpoint,
        [string]$Description,
        [string[]]$ExpectedKeys
    )
    
    Write-Host "`n--- $Description ---" -ForegroundColor Cyan
    Write-Host "GET $API_BASE$Endpoint" -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE$Endpoint" -Headers $headers -Method GET -TimeoutSec 10
        Write-Host "[OK] Response received" -ForegroundColor Green
        
        # Pretty print JSON
        $json = $response | ConvertTo-Json -Depth 5
        Write-Host $json -ForegroundColor White
        
        # Schema validation
        if ($ExpectedKeys.Count -gt 0) {
            Write-Host "`nSchema Check:" -ForegroundColor Yellow
            $responseKeys = if ($response -is [array]) { 
                if ($response.Count -gt 0) { $response[0].PSObject.Properties.Name } else { @() }
            } else { 
                $response.PSObject.Properties.Name 
            }
            
            foreach ($key in $ExpectedKeys) {
                if ($responseKeys -contains $key) {
                    Write-Host "  [OK] $key" -ForegroundColor Green
                } else {
                    Write-Host "  [MISSING] $key" -ForegroundColor Red
                }
            }
        }
        
        return $true
    } catch {
        $status = $_.Exception.Response.StatusCode
        Write-Host "[FAIL] Request failed" -ForegroundColor Red
        Write-Host "  Status: $status" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test each critical endpoint
$results = @{}

# 1. Overview Stats
$results["overview"] = Test-Endpoint -Endpoint "/analytics/overview" `
    -Description "Overview Stats" `
    -ExpectedKeys @("total_output", "avg_efficiency", "active_lines", "last_updated")

# 2. Production Chart
$results["production-chart"] = Test-Endpoint -Endpoint "/analytics/production-chart" `
    -Description "Production Chart Data" `
    -ExpectedKeys @("data_points", "line_filter")

# 3. DHU Quality
$results["quality-dhu"] = Test-Endpoint -Endpoint "/analytics/quality/dhu" `
    -Description "DHU Quality History" `
    -ExpectedKeys @("date", "dhu")

# 4. Target Realization
$results["target-realization"] = Test-Endpoint -Endpoint "/analytics/target-realization" `
    -Description "Target Realization" `
    -ExpectedKeys @()

# 5. Earned Minutes
$results["earned-minutes"] = Test-Endpoint -Endpoint "/analytics/earned-minutes" `
    -Description "Earned Minutes Stats" `
    -ExpectedKeys @("earned_minutes", "total_available_minutes", "efficiency_pct_aggregate")

# Summary
Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "           SUMMARY                   " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$passed = ($results.Values | Where-Object { $_ -eq $true }).Count
$total = $results.Count

Write-Host "Endpoints Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

foreach ($key in $results.Keys) {
    $status = if ($results[$key]) { "[PASS]" } else { "[FAIL]" }
    $color = if ($results[$key]) { "Green" } else { "Red" }
    Write-Host "  $status $key" -ForegroundColor $color
}

Write-Host "`nDone!" -ForegroundColor Cyan
