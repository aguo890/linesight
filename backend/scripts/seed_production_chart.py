# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Seed production runs for the past 14 days to populate the Production Chart.
Run this script to create sample data for testing the dashboard.
"""

import os
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal

# Add parent directory to path
sys.path.append(os.getcwd())

from app.core.database import SyncSessionLocal
from app.models import (
    Factory,
    Order,
    Organization,
    ProductionLine,
    ProductionRun,
    Style,
)
from app.models.production import OrderStatus, ShiftType


def seed_production_chart_data():
    """Seed 14 days of production run data for the production chart."""
    db = SyncSessionLocal()
    print("🌱 Seeding Production Chart Data (14 days)...")

    try:
        # 1. Get or Create Organization
        org = db.query(Organization).first()
        if not org:
            print("Creating Demo Organization...")
            org = Organization(
                name="Demo Org", slug="demo-org", subscription_plan="enterprise"
            )
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

        # 3. Get or Create Production Line
        line = (
            db.query(ProductionLine)
            .filter(
                ProductionLine.factory_id == factory.id,
                ProductionLine.name == "Sewing Line A",
            )
            .first()
        )
        if not line:
            print("Creating Production Line...")
            line = ProductionLine(
                name="Sewing Line A", factory_id=factory.id, code="L-A"
            )
            db.add(line)
            db.flush()

        # 4. Get or Create a Style and Order
        style = (
            db.query(Style)
            .filter(
                Style.factory_id == factory.id, Style.style_number == "ST-CHART-001"
            )
            .first()
        )

        if not style:
            print("Creating Style...")
            style = Style(
                factory_id=factory.id,
                style_number="ST-CHART-001",
                description="Sample T-Shirt for Chart Data",
            )
            db.add(style)
            db.flush()

        order = (
            db.query(Order)
            .filter(Order.style_id == style.id, Order.po_number == "PO-CHART-001")
            .first()
        )

        if not order:
            print("Creating Order...")
            order = Order(
                style_id=style.id,
                po_number="PO-CHART-001",
                quantity=30000,  # Large enough for 14 days
                status=OrderStatus.SEWING,
                order_date=datetime.now().date() - timedelta(days=20),
                ex_factory_date=datetime.now().date() + timedelta(days=10),
            )
            db.add(order)
            db.flush()

        # 5. Create Production Runs for the past 14 days
        print("Creating 14 days of production runs...")

        # Delete existing runs for this order to avoid duplicates
        db.query(ProductionRun).filter(ProductionRun.order_id == order.id).delete()
        db.commit()

        today = datetime.now().date()

        for days_ago in range(13, -1, -1):  # 13 days ago to today
            production_date = today - timedelta(days=days_ago)

            # Generate realistic production data with some variation
            # Target: 2000 pieces per day
            # Actual: varies between 1600-2200 with a trend upward
            base_target = 2000
            base_actual = 1600 + (13 - days_ago) * 40  # Gradual improvement

            # Add some randomness
            actual_qty = int(base_actual + random.randint(-100, 150))
            planned_qty = base_target + random.randint(-50, 50)

            # Ensure actual doesn't exceed planned by too much
            if actual_qty > planned_qty * 1.1:
                actual_qty = int(planned_qty * random.uniform(0.95, 1.05))

            run = ProductionRun(
                order_id=order.id,
                line_id=line.id,
                production_date=production_date,
                actual_qty=actual_qty,
                planned_qty=planned_qty,
                shift=ShiftType.DAY,
                operators_present=random.randint(45, 55),
                worked_minutes=Decimal(str(480 * random.randint(45, 55))),
            )
            db.add(run)
            print(f"  {production_date}: Actual={actual_qty}, Target={planned_qty}")

        db.commit()
        print("✅ Production Chart Data Seeded Successfully!")
        print(
            f"   Created 14 days of production runs from {today - timedelta(days=13)} to {today}"
        )

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_production_chart_data()
