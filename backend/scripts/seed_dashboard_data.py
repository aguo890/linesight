# scripts/seed_dashboard_data.py
import os
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Add parent directory to path
sys.path.append(os.getcwd())

from app.core.database import SyncSessionLocal
from app.models import (
    DHUReport,
    EfficiencyMetric,
    Factory,
    Order,
    Organization,
    ProductionLine,
    ProductionRun,
    Style,
)
from app.models.analytics import PeriodType
from app.models.production import OrderStatus, ShiftType


def seed_data():
    db = SyncSessionLocal()
    print("🌱 Clearing and Seeding Dashboard Data...")

    try:
        # 1. Get or Create Organization
        org = db.query(Organization).first()
        if not org:
            print("Creating Demo Organization...")
            org = Organization(
                name="Demo Org", slug="demo-org", subscription_plan="enterprise"
            )  # subscription_plan is guessed, but name/slug are standard
            db.add(org)
            db.flush()

        # 2. Get or Create Factory
        factory = db.query(Factory).filter(Factory.name == "Demo Factory").first()
        if not factory:
            print("Creating Demo Factory...")
            factory = Factory(
                name="Demo Factory",
                country="Vietnam",
                organization_id=org.id,
                timezone="Asia/Ho_Chi_Minh",
            )
            db.add(factory)
            db.flush()

        print(f"Using Factory: {factory.name} ({factory.id})")

        # Clear relevant data
        # We find styles for this factory and delete them, cascading to orders/runs
        print("Clearing old data...")
        db.query(DHUReport).filter(DHUReport.factory_id == factory.id).delete()

        styles = db.query(Style).filter(Style.factory_id == factory.id).all()
        for s in styles:
            # Manually delete dependent orders if cascade isn't set up perfectly in DB schema (though models say cascade)
            # SQLAlchemy cascade works on session delete, but query.delete() issues DELETE SQL directly.
            # Ideally we fetch and delete.
            db.delete(s)

        db.commit()  # Commit deletions

        # Re-create line
        line = (
            db.query(ProductionLine)
            .filter(
                ProductionLine.factory_id == factory.id,
                ProductionLine.name == "Sewing Line A",
            )
            .first()
        )
        if not line:
            line = ProductionLine(
                name="Sewing Line A", factory_id=factory.id, code="L-A"
            )
            db.add(line)
            db.flush()

        # 3. Seed DHU Reports (7 Days)
        print("🌱 Seeding DHU Reports...")
        base_date = datetime.now().date() - timedelta(days=6)
        dhu_trend = [5.2, 4.8, 3.5, 2.9, 2.1, 1.5, 1.1]

        for i, dhu_val in enumerate(dhu_trend):
            report_date = base_date + timedelta(days=i)
            report = DHUReport(
                factory_id=factory.id,
                report_date=report_date,
                period_type=PeriodType.DAILY,
                avg_dhu=Decimal(str(dhu_val)),
                total_inspected=1000,
                total_defects=int(dhu_val * 10),
            )
            db.add(report)

        # 4. Seed Styles & Orders
        print("🌱 Seeding Styles & Orders...")

        on_track_styles = [
            ("ST-101", "Midnight Blue T-Shirt", 5000, 4800),
            ("ST-102", "Classic V-Neck", 3000, 1500),
            ("ST-103", "Summer Tank", 2000, 200),
        ]
        behind_styles = [
            ("ST-999", "Complex Hoodie", 1000, 200),
            ("ST-888", "Cargo Shorts", 2500, 1000),
        ]
        all_styles = on_track_styles + behind_styles

        for code, desc, target, current in all_styles:
            # Style
            style = Style(factory_id=factory.id, style_number=code, description=desc)
            db.add(style)
            db.flush()

            # Order
            order = Order(
                style_id=style.id,
                po_number=f"PO-{random.randint(10000, 99999)}",
                quantity=target,
                status=OrderStatus.SEWING,  # Active
                order_date=datetime.now().date() - timedelta(days=10),
                ex_factory_date=datetime.now().date() + timedelta(days=5),
            )
            db.add(order)
            db.flush()

            # Production Run (Today)
            run = ProductionRun(
                order_id=order.id,
                line_id=line.id,
                production_date=datetime.now().date(),
                actual_qty=current,
                planned_qty=target if "ST-999" not in code else target * 2,
                shift=ShiftType.DAY,
            )
            db.add(run)
            db.flush()

            # Efficiency Metric
            # "Complex Hoodie" (ST-999) -> Low Efficiency
            eff = 95.0
            if "ST-999" in code:
                eff = 45.0
            elif "ST-888" in code:
                eff = 60.0

            # EfficiencyMetric requires calculated_at (Mapped[datetime], nullable=False)
            metric = EfficiencyMetric(
                production_run_id=run.id,
                efficiency_pct=Decimal(str(eff)),
                calculated_at=datetime.now(),
            )
            db.add(metric)

        db.commit()
        print("✅ Database Seeded Successfully!")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
