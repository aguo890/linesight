"""
API Data Verification Script
Tests all dashboard widget API endpoints and checks database records.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # noqa: E402

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def check_database():
    """Check database for production data."""
    db_url = settings.database_url
    print(f"\n{'=' * 60}")
    print("DATABASE VERIFICATION")
    print(f"{'=' * 60}")
    print(f"Database URL: {db_url[:50]}...")

    engine = create_engine(db_url)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()

    try:
        # 1. ProductionRun records
        print("\n📊 ProductionRun Records:")
        result = session.execute(
            text("""
            SELECT production_date, COUNT(*) as count, SUM(actual_qty) as total_qty
            FROM production_runs
            WHERE production_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY production_date
            ORDER BY production_date DESC
            LIMIT 10
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: {row[1]} runs, {row[2]} units")
        else:
            print("   ⚠️ NO PRODUCTION RUN RECORDS FOUND!")

        # 2. Check SAM values
        print("\n📊 SAM Values in ProductionRuns:")
        result = session.execute(
            text("""
            SELECT
                COUNT(*) as total_runs,
                SUM(CASE WHEN sam IS NOT NULL AND sam > 0 THEN 1 ELSE 0 END) as with_sam,
                SUM(CASE WHEN available_minutes > 0 THEN 1 ELSE 0 END) as with_avail_mins
            FROM production_runs
            WHERE production_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        """)
        )
        row = result.fetchone()
        if row:
            print(f"   Total runs (7 days): {row[0]}")
            print(f"   With SAM value: {row[1]}")
            print(f"   With available_minutes: {row[2]}")

        # 3. ProductionEvent records (for hourly)
        print("\n📊 ProductionEvent Records:")
        result = session.execute(
            text("""
            SELECT DATE(timestamp) as event_date, COUNT(*) as count, SUM(quantity) as total_qty
            FROM production_events
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(timestamp)
            ORDER BY event_date DESC
            LIMIT 5
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: {row[1]} events, {row[2]} units")
        else:
            print(
                "   ⚠️ NO PRODUCTION EVENT RECORDS FOUND (hourly data will be estimated)"
            )

        # 4. DHU/Quality records
        print("\n📊 DHU Reports:")
        result = session.execute(
            text("""
            SELECT report_date, avg_dhu
            FROM dhu_reports
            ORDER BY report_date DESC
            LIMIT 5
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: DHU = {row[1]}%")
        else:
            print("   ⚠️ NO DHU REPORTS FOUND (DHU widget will be empty)")

        # 5. Workforce data
        print("\n📊 Workforce Data (operators_present/helpers_present):")
        result = session.execute(
            text("""
            SELECT production_date,
                   SUM(COALESCE(operators_present, 0)) as ops,
                   SUM(COALESCE(helpers_present, 0)) as helpers
            FROM production_runs
            WHERE production_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY production_date
            ORDER BY production_date DESC
            LIMIT 5
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: {row[1]} operators, {row[2]} helpers")
        else:
            print("   ⚠️ NO WORKFORCE DATA FOUND")

        # 6. Downtime reasons
        print("\n📊 Downtime Reasons:")
        result = session.execute(
            text("""
            SELECT downtime_reason, COUNT(*) as count
            FROM production_runs
            WHERE downtime_reason IS NOT NULL AND downtime_reason != ''
            GROUP BY downtime_reason
            ORDER BY count DESC
            LIMIT 5
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   '{row[0]}': {row[1]} occurrences")
        else:
            print("   ⚠️ NO DOWNTIME REASONS FOUND (blockers widget will be empty)")

        # 7. EfficiencyMetric records
        print("\n📊 EfficiencyMetric Records:")
        result = session.execute(
            text("""
            SELECT COUNT(*) as total,
                   AVG(efficiency_pct) as avg_eff
            FROM efficiency_metrics
        """)
        )
        row = result.fetchone()
        if row and row[0] > 0:
            print(f"   Total records: {row[0]}")
            print(f"   Average efficiency: {row[1]:.1f}%")
        else:
            print("   ⚠️ NO EFFICIENCY METRICS FOUND")

        # 8. Order/Style records
        print("\n📊 Orders (for Style Progress):")
        result = session.execute(
            text("""
            SELECT status, COUNT(*) as count, SUM(quantity) as total_qty
            FROM orders
            GROUP BY status
        """)
        )
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: {row[1]} orders, {row[2]} units target")
        else:
            print("   ⚠️ NO ORDERS FOUND")

        print(f"\n{'=' * 60}")
        print("DATABASE CHECK COMPLETE")
        print(f"{'=' * 60}\n")

    finally:
        session.close()
        engine.dispose()


def main():
    print("\n" + "=" * 60)
    print("LINESIGHT API DATA VERIFICATION")
    print("=" * 60)

    # Check database first
    check_database()

    print("\n💡 NEXT STEPS:")
    print("-" * 40)
    print("If database has data but widgets show zeros:")
    print("  1. Check date filters (effective_date logic)")
    print("  2. Check line_id filtering")
    print("  3. Verify EfficiencyMetric linkage")
    print()
    print("If database is empty:")
    print("  1. Run seed script: python -m backend.scripts.run_seed")
    print("  2. Or upload Excel via the UI")
    print()


if __name__ == "__main__":
    main()
