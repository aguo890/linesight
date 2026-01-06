# Next Chat: API Data Verification

## Objective
Verify that all 13 dashboard widget API endpoints are returning correct, meaningful data from the database (not zeros or empty arrays).

## Context
- Widget migration to real endpoints is complete
- All Zod schemas are in place for runtime validation
- Browser testing showed some widgets returning zeros or "No Data"

## Verification Checklist

### 1. Test Each Endpoint Manually
Run these curl commands (or use browser dev tools) to verify data:

```powershell
# Get auth token first, then test each endpoint:
$token = "YOUR_AUTH_TOKEN"

# 1. Production Chart
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/production-chart

# 2. Overview/Efficiency KPI
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/overview

# 3. Target Realization
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/target-realization

# 4. Earned Minutes
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/earned-minutes

# 5. DHU Quality
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/quality/dhu

# 6. Speed vs Quality
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/speed-vs-quality

# 7. Style Progress
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/production/styles

# 8. Complexity
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/complexity

# 9. Downtime/Blockers
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/downtime

# 10. Workforce
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/workforce

# 11. Hourly Production (Timeline)
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/hourly-production

# 12. SAM Performance
curl -H "Authorization: Bearer $token" http://localhost:8000/api/v1/analytics/sam-performance
```

### 2. Database Data Check
Verify the database has actual production data for today/recent dates:

```sql
-- Check for ProductionRun records
SELECT production_date, COUNT(*), SUM(actual_qty) 
FROM production_runs 
GROUP BY production_date 
ORDER BY production_date DESC 
LIMIT 10;

-- Check for ProductionEvent records (for hourly granularity)
SELECT DATE(timestamp), COUNT(*), SUM(quantity) 
FROM production_events 
GROUP BY DATE(timestamp) 
ORDER BY DATE(timestamp) DESC 
LIMIT 10;

-- Check for QualityInspection records (for DHU)
SELECT DATE(inspection_date), COUNT(*) 
FROM quality_inspections 
GROUP BY DATE(inspection_date) 
ORDER BY DATE(inspection_date) DESC 
LIMIT 10;
```

### 3. Expected Issues to Fix
- **Zeros in Earned Minutes**: May need to verify `sam` values are populated in ProductionRun
- **Empty DHU chart**: May need to add QualityInspection records
- **Empty Downtime/Blockers**: May need to add `downtime_reason` data
- **Workforce zeros**: May need `operators_present`/`helpers_present` data

### 4. Seed Data Option
If database is empty, consider:
1. Running the seed script: `python -m backend.scripts.run_seed`
2. Uploading sample Excel files through the ingestion UI
3. Creating a dedicated test data generator

## Files to Reference
- Backend endpoints: `backend/app/api/v1/endpoints/analytics.py`
- Frontend registry: `frontend/src/features/dashboard/registry.tsx`
- Endpoint mapping: `frontend/src/features/dashboard/hooks/useWidgetData.ts`

## Success Criteria
- [ ] All 13 endpoints return non-empty, meaningful data
- [ ] Frontend widgets display actual values (no "DEMO MODE" badges)
- [ ] No Zod validation errors in browser console
