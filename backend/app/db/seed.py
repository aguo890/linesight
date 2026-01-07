"""
Database seeding utility.
Populates the database with realistic development data.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.enums import OrderPriority, OrderStatus
from app.models.analytics import EfficiencyMetric
# from app.models.compliance import (
#     ComplianceStandard,
#     TraceabilityRecord,
#     VerificationStatus,
# )
from app.models.factory import Factory, ProductionLine
from app.models.production import (
    Order,
    ProductionRun,
    Style,
)
from app.models.user import Organization, User, UserRole
from app.models.workforce import Worker, WorkerSkill


async def seed_data(db: AsyncSession):
    """Seed the database with initial development data."""

    # 0. Clear existing Production Runs to allow regeneration with correct data
    print("Clearing existing Production Run data...")
    # Delete dependent metrics first (though CASCADE should handle it, explicit is safer for some DBs)
    await db.execute(delete(EfficiencyMetric))
    await db.execute(delete(ProductionRun))
    await db.flush()

    # 1. Create Organization
    org_query = select(Organization).where(Organization.code == "ORG-DEV")
    org_result = await db.execute(org_query)
    org = org_result.scalar_one_or_none()

    if not org:
        org = Organization(
            name="Development Org", code="ORG-DEV", subscription_tier="enterprise"
        )
        db.add(org)
        await db.flush()
        print(f"Created Organization: {org.name}")

    # 2. Create Admin User
    admin_query = select(User).where(User.email == "admin@linesight.dev")
    admin_result = await db.execute(admin_query)
    admin_user = admin_result.scalar_one_or_none()

    if not admin_user:
        admin_user = User(
            organization_id=org.id,
            email="admin@linesight.dev",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        print(f"Created Admin User: {admin_user.email}")

    # 3. Create Factory
    factory_query = select(Factory).where(Factory.code == "FAC-001")
    factory_result = await db.execute(factory_query)
    factory = factory_result.scalar_one_or_none()

    if not factory:
        factory = Factory(
            organization_id=org.id,
            name="Main Production Center",
            code="FAC-001",
            country="VN",
            city="Ho Chi Minh City",
            timezone="Asia/Ho_Chi_Minh",
            total_workers=250,
        )
        db.add(factory)
        await db.flush()
        print(f"Created Factory: {factory.name}")

    # 4. Create Production Lines
    lines = []
    for i in range(1, 5):
        line_code = f"LINE-{i:02d}"
        line_query = select(ProductionLine).where(ProductionLine.code == line_code)
        line_result = await db.execute(line_query)
        line = line_result.scalar_one_or_none()

        if not line:
            line = ProductionLine(
                factory_id=factory.id,
                name=f"Production Line {i}",
                code=line_code,
                is_active=True,
                target_efficiency_pct=85,
            )
            db.add(line)
        lines.append(line)
    await db.flush()

    # 5. Create Styles and Orders
    styles = []
    orders = []
    style_data = [
        {"num": "STY-TS-001", "name": "Basic T-Shirt", "sam": 12.5},
        {"num": "STY-HD-002", "name": "Premium Hoodie", "sam": 45.0},
        {"num": "STY-JN-003", "name": "Straight Fit Denim", "sam": 62.0},
    ]

    for s in style_data:
        style_query = select(Style).where(Style.style_number == s["num"])
        style_result = await db.execute(style_query)
        style = style_result.scalar_one_or_none()

        if not style:
            style = Style(
                factory_id=factory.id,
                style_number=s["num"],
                base_sam=Decimal(str(s["sam"])),
            )
            db.add(style)
            await db.flush()
        styles.append(style)

        # Create an order per style
        if not s["num"] or not isinstance(s["num"], str):
            continue
        po_num = f"PO-{s['num'].split('-')[-1]}"
        order_query = select(Order).where(Order.po_number == po_num)
        order_result = await db.execute(order_query)
        order = order_result.scalar_one_or_none()

        if not order:
            order = Order(
                po_number=po_num,
                style_id=style.id,
                quantity=10000,
                status=OrderStatus.CONFIRMED.value,
                priority=OrderPriority.NORMAL.value,
            )
            db.add(order)
            await db.flush()
        orders.append(order)
    await db.flush()

    # 6. Create Workers
    worker_names = ["Thao Nguyen", "Minh Tran", "Hoa Pham", "Dung Le", "Anh Vu"]
    workers = []
    for i, name in enumerate(worker_names):
        emp_id = f"W-{100 + i}"
        worker_query = select(Worker).where(Worker.employee_id == emp_id)
        worker_result = await db.execute(worker_query)
        worker = worker_result.scalar_one_or_none()

        if not worker:
            worker = Worker(
                factory_id=factory.id,
                employee_id=emp_id,
                full_name=name,
                line_id=lines[i % len(lines)].id,
                is_active=True,
            )
            db.add(worker)
            await db.flush()

            # Add some skills
            skill = WorkerSkill(
                worker_id=worker.id,
                operation="Sewing",
                efficiency_pct=Decimal(str(70 + (i * 5))),
            )
            db.add(skill)
        workers.append(worker)

    # 7. Create Historical Production Runs (Last 7 days)
    today = date.today()
    for d in range(7):
        target_date = today - timedelta(days=d)
        for line in lines:
            # Check if run exists
            run_query = select(ProductionRun).where(
                ProductionRun.line_id == line.id,
                ProductionRun.production_date == target_date,
            )
            run_result = await db.execute(run_query)
            run = run_result.scalar_one_or_none()

            if not run:
                style = styles[d % len(styles)]
                order = orders[d % len(orders)]
                planned = 500
                actual = int(planned * (0.8 + (0.05 * (d % 4))))

                run = ProductionRun(
                    factory_id=factory.id,
                    production_date=target_date,
                    order_id=order.id,
                    line_id=line.id,
                    planned_qty=planned,
                    actual_qty=actual,
                    worked_minutes=Decimal("480"),
                    operators_present=20,
                    sam=style.base_sam,  # Explicitly populate SAM for complexity analysis
                )
                db.add(run)
                await db.flush()

                # Add efficiency metric
                eff_pct = Decimal(str((actual / planned) * 100))
                metric = EfficiencyMetric(
                    production_run_id=run.id,
                    efficiency_pct=eff_pct,
                    sam_target=Decimal(str(planned * (style.base_sam or 0))),
                    sam_actual=Decimal(str(actual * (style.base_sam or 0))),
                    calculated_at=datetime.utcnow(),
                )
                db.add(metric)

                # Add a few discrepancies for variety
                # if d == 0 and line.id == lines[0].id:
                #     record = TraceabilityRecord(
                #         compliance_standard=ComplianceStandard.UFLPA,
                #         verification_status=VerificationStatus.FLAGGED,
                #         risk_notes="Possible material origin discrepancy detected in automated scan.",
                #         production_run_id=run.id,
                #     )
                #     db.add(record)

    await db.commit()
    print("Database seeding completed.")
