import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal
from app.models.production import ProductionRun

async def check_duplicates():
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
        
        if not rows:
            print("✅ No duplicates found.")
        else:
            print(f"❌ Found {len(rows)} groups of duplicates!")
            print("-" * 60)
            print(f"{'Date':<12} | {'Shift':<10} | {'Count':<5} | {'Total Qty'}")
            print("-" * 60)
            for row in rows:
                print(f"{str(row.p_date):<12} | {row.shift:<10} | {row.count:<5} | {row.total_qty}")

if __name__ == "__main__":
    # Ensure we can import app
    try:
        asyncio.run(check_duplicates())
    except Exception as e:
        print(f"Error: {e}")
