import asyncio
import sys

# Ensure /app is in python path (for Docker environment)
sys.path.append('/app')

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


async def check_duplicates():
    try:
        async with AsyncSessionLocal() as db:
            print("Checking for duplicate ProductionRun entries...")

            # SQL to find duplicates based on logical key: (order_id, data_source_id, date(production_date), shift)
            query = text("""
                SELECT 
                    p.data_source_id,
                    p.order_id,
                    DATE(p.production_date) as p_date,
                    p.shift,
                    COUNT(*) as count,
                    SUM(p.actual_qty) as total_qty
                FROM production_runs p
                GROUP BY p.data_source_id, p.order_id, DATE(p.production_date), p.shift
                HAVING COUNT(*) > 1
            """)

            result = await db.execute(query)
            rows = result.fetchall()

            # Check for suspicious shifts
            print("\nAnalyzing Shift values...")
            shift_query = text("SELECT DISTINCT shift, COUNT(*) FROM production_runs GROUP BY shift")
            s_result = await db.execute(shift_query)
            for s_row in s_result.fetchall():
                print(f"Shift: '{s_row[0]}' | Count: {s_row[1]}")

            # Check for potential "Total" row double counting
            # Logic: If we have multiple rows for same Date/Order, listing them might reveal the pattern
            print("\nSample of multi-row days (potential double counting):")
            sample_query = text("""
                SELECT 
                    data_source_id, DATE(production_date) as d, order_id, array_agg(shift) as shifts, sum(actual_qty) as total_qty
                FROM production_runs
                GROUP BY data_source_id, order_id, DATE(production_date)
                HAVING COUNT(*) > 1
                LIMIT 5
            """)
            sample_res = await db.execute(sample_query)
            for row in sample_res:
                print(f"Date: {row.d} | Shifts: {row.shifts} | Total: {row.total_qty}")


    except Exception as e:
        print(f"Error executing query: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_duplicates())
