#!/usr/bin/env python
"""
Production Data Generator Script

Generates realistic production data for the current day that feeds all 13 dashboard widgets.
Uses demo@linesight.io account (or creates if needed), creates a factory, production line,
dashboard, and populates with verifiable data.

Usage:
    python scripts/generate_production_data.py [--cleanup]

Options:
    --cleanup   Delete all test data from previous runs before generating new data
"""

import argparse
import asyncio
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.analytics import DHUReport, EfficiencyMetric
from app.models.dashboard import Dashboard
from app.models.datasource import DataSource, SchemaMapping
from app.models.events import EventType, ProductionEvent
from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style
from app.models.quality import QualityInspection
from app.models.raw_import import RawImport, StagingRecord
from app.models.user import Organization, User, UserRole
from app.models.workforce import ProductionOutput, Worker

# =============================================================================
# Configuration
# =============================================================================

FACTORY_NAME_PREFIX = "LineSight Test Factory"
FACTORY_TIMEZONE = "Africa/Cairo"
LINE_NAME = "Sewing Line Alpha"
DASHBOARD_NAME = "Today's Production Dashboard"

DEMO_USER_EMAIL = "demo@linesight.io"
DEMO_USER_PASSWORD = "demo123"
DEMO_ORG_NAME = "LineSight Demo Org"
DEMO_ORG_CODE = "DEMO-ORG"

# Random seed for reproducibility
RANDOM_SEED = 42

# Production data configuration
NUM_STYLES = 4
PRODUCTION_HOURS = list(range(8, 18))  # 08:00 - 17:00 (10 hours)
EVENTS_PER_HOUR_MIN = 5
EVENTS_PER_HOUR_MAX = 15

# Historical data range (3 months = ~90 days)
HISTORICAL_DAYS = 90


# =============================================================================
# Style Definitions (Realistic garment types)
# =============================================================================

STYLE_CONFIGS = [
    {
        "code": "STY-2026-TS01",
        "name": "Basic T-Shirt",
        "sam": Decimal("2.5"),
        "order_qty": 50000,
    },
    {
        "code": "STY-2026-HD02",
        "name": "Premium Hoodie",
        "sam": Decimal("4.5"),
        "order_qty": 30000,
    },
    {
        "code": "STY-2026-PL03",
        "name": "Polo Shirt",
        "sam": Decimal("3.2"),
        "order_qty": 40000,
    },
    {
        "code": "STY-2026-JK04",
        "name": "Light Jacket",
        "sam": Decimal("5.0"),
        "order_qty": 25000,
    },
]

DOWNTIME_REASONS = [
    "Machine Brake",
    "Material Shortage",
    "Quality Hold",
    "Operator Break",
    "Maintenance",
    "Line Changeover",
]


# =============================================================================
# Database Connection
# =============================================================================


def get_async_engine():
    """Create async database engine."""
    # Replace pymysql with aiomysql for async support
    async_url = settings.DATABASE_URL.replace("pymysql", "aiomysql")
    return create_async_engine(
        async_url,
        echo=False,
        pool_pre_ping=True,
    )


# =============================================================================
# Setup Functions
# =============================================================================


async def ensure_demo_user(db: AsyncSession) -> tuple[User, Organization]:
    """Get or create the demo user and organization.

    IMPORTANT: If the demo user already exists, we use THEIR organization
    so that any factories we create are visible when they log in.
    """

    # First, check for existing user
    user_result = await db.execute(select(User).where(User.email == DEMO_USER_EMAIL))
    user = user_result.scalar_one_or_none()

    if user:
        # User exists - get their organization
        print(f"👤 Using existing user: {user.email}")
        org_result = await db.execute(
            select(Organization).where(Organization.id == user.organization_id)
        )
        org = org_result.scalar_one_or_none()
        if org:
            print(f"📦 Using user's organization: {org.name}")
        else:
            raise ValueError(f"User {user.email} has no valid organization!")
        return user, org

    # No existing user - create org and user
    print(f"📦 Creating organization: {DEMO_ORG_NAME}")
    org = Organization(
        name=DEMO_ORG_NAME,
        code=DEMO_ORG_CODE,
        subscription_tier="enterprise",
        max_factories=10,
        max_lines_per_factory=20,
    )
    db.add(org)
    await db.flush()

    print(f"👤 Creating demo user: {DEMO_USER_EMAIL}")
    user = User(
        organization_id=org.id,
        email=DEMO_USER_EMAIL,
        hashed_password=hash_password(DEMO_USER_PASSWORD),
        full_name="Demo User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    return user, org


async def cleanup_existing_test_data(db: AsyncSession, org: Organization):
    """Remove existing test factories across ALL orgs (in case of orphaned data)."""

    # Find ALL test factories by name prefix (across all orgs)
    result = await db.execute(
        select(Factory).where(Factory.name.like(f"{FACTORY_NAME_PREFIX}%"))
    )
    factories = result.scalars().all()

    if not factories:
        print("🧹 No existing test data to clean up")
        return

    for factory in factories:
        print(f"🗑️  Deleting factory: {factory.name} (org: {factory.organization_id})")
        # Explicit delete references to avoid foreign key constraints
        # 1. Styles (and cascades to Orders -> Runs -> Outputs/Events)
        await db.execute(delete(Style).where(Style.factory_id == factory.id))

        # 2. Workers
        await db.execute(delete(Worker).where(Worker.factory_id == factory.id))

        # 3. DHU Reports
        await db.execute(delete(DHUReport).where(DHUReport.factory_id == factory.id))

        # 4. Raw Imports (if any remain)
        await db.execute(delete(RawImport).where(RawImport.factory_id == factory.id))

        # 5. Production Lines (and cascades to DataSources)
        await db.execute(
            delete(ProductionLine).where(ProductionLine.factory_id == factory.id)
        )

        await db.delete(factory)

    await db.flush()
    print(f"🧹 Cleaned up {len(factories)} test factory(ies)")


async def create_test_factory(db: AsyncSession, org: Organization) -> Factory:
    """Create a new test factory with today's date."""

    today = date.today().isoformat()
    factory_name = f"{FACTORY_NAME_PREFIX} {today}"

    # Generate unique code with timestamp to avoid conflicts
    import time

    unique_code = f"TEST-{int(time.time()) % 100000}"

    # Check if already exists (idempotent)
    result = await db.execute(
        select(Factory).where(
            Factory.organization_id == org.id, Factory.name == factory_name
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"🏭 Factory already exists: {factory_name}")
        return existing

    factory = Factory(
        organization_id=org.id,
        name=factory_name,
        code=unique_code,
        country="EG",
        city="Cairo",
        timezone=FACTORY_TIMEZONE,
        total_workers=50,
    )
    db.add(factory)
    await db.flush()

    print(f"🏭 Created factory: {factory.name} (ID: {factory.id})")
    return factory


async def create_production_line(db: AsyncSession, factory: Factory) -> ProductionLine:
    """Create a production line for the test factory."""

    # Check if exists
    result = await db.execute(
        select(ProductionLine).where(
            ProductionLine.factory_id == factory.id, ProductionLine.name == LINE_NAME
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"⚙️  Production line already exists: {LINE_NAME}")
        return existing

    line = ProductionLine(
        factory_id=factory.id,
        name=LINE_NAME,
        code="L-ALPHA",
        is_active=True,
        target_efficiency_pct=85,
        target_operators=15,
    )
    db.add(line)
    await db.flush()

    print(f"⚙️  Created production line: {line.name} (ID: {line.id})")
    return line


async def create_data_source(db: AsyncSession, line: ProductionLine) -> DataSource:
    """Create a data source for the production line."""

    # Check if exists
    result = await db.execute(
        select(DataSource).where(DataSource.production_line_id == line.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        print("📊 Data source already exists for line")
        return existing

    ds = DataSource(
        production_line_id=line.id,
        source_name="Test Production Data",
        description="Auto-generated test data for widget verification",
        time_column="production_date",
        is_active=True,
    )
    db.add(ds)
    await db.flush()

    print(f"📊 Created data source (ID: {ds.id})")
    return ds


async def create_raw_import(
    db: AsyncSession,
    user: User,
    factory: Factory,
    line: ProductionLine,
    data_source: DataSource,
) -> RawImport:
    """Create a fake RawImport record to mimic file upload flow."""
    import hashlib
    import json

    today = date.today().isoformat()
    filename = f"production_data_{today}.xlsx"

    # Check if exists
    result = await db.execute(
        select(RawImport).where(
            RawImport.data_source_id == data_source.id,
            RawImport.original_filename == filename,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"📁 Raw import already exists: {filename}")
        return existing

    # Generate fake file hash
    file_hash = hashlib.sha256(f"{filename}-{today}-test".encode()).hexdigest()

    # Sample headers matching what widgets expect
    headers = json.dumps(
        [
            "style_number",
            "po_number",
            "production_date",
            "shift",
            "actual_qty",
            "planned_qty",
            "sam",
            "operators_present",
            "helpers_present",
            "worked_minutes",
            "downtime_minutes",
            "downtime_reason",
            "defects",
        ]
    )

    # Sample data (first few rows)
    sample_data = json.dumps(
        [
            {
                "style_number": "STY-2026-TS01",
                "po_number": "PO-TEST-TS01",
                "production_date": today,
                "shift": "day",
                "actual_qty": 127,
                "planned_qty": 178,
                "sam": 2.5,
                "operators_present": 12,
                "helpers_present": 3,
                "worked_minutes": 480,
                "downtime_minutes": 15,
                "downtime_reason": "Machine Brake",
                "defects": 2,
            },
            {
                "style_number": "STY-2026-HD02",
                "po_number": "PO-TEST-HD02",
                "production_date": today,
                "shift": "day",
                "actual_qty": 147,
                "planned_qty": 159,
                "sam": 4.5,
                "operators_present": 14,
                "helpers_present": 4,
                "worked_minutes": 480,
                "downtime_minutes": 0,
                "downtime_reason": None,
                "defects": 5,
            },
        ]
    )

    raw_import = RawImport(
        uploaded_by_id=user.id,
        factory_id=factory.id,
        production_line_id=line.id,
        data_source_id=data_source.id,
        time_column_used="production_date",
        original_filename=filename,
        file_path=f"uploads/{factory.id}/{line.id}/{filename}",
        file_size_bytes=15360,  # ~15KB fake size
        file_hash=file_hash,
        mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        encoding_detected="UTF-8",
        sheet_count=1,
        sheet_names=json.dumps(["Production Data"]),
        row_count=5,  # 4 data rows + 1 header
        column_count=13,
        header_row_detected=0,
        raw_headers=headers,
        sample_data=sample_data,
        status="promoted",  # Matches real flow after promote step
        processed_at=datetime.now(timezone.utc),
    )
    db.add(raw_import)
    await db.flush()

    print(f"📁 Created raw import: {filename} (ID: {raw_import.id})")
    return raw_import


# =============================================================================
# Data Generation Functions
# =============================================================================


async def create_schema_mapping(
    db: AsyncSession, data_source: DataSource
) -> SchemaMapping:
    """Create a schema mapping for the data source (mirrors confirm-mapping step)."""

    # Check if exists
    result = await db.execute(
        select(SchemaMapping).where(SchemaMapping.data_source_id == data_source.id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        print("📋 Schema mapping already exists for data source")
        return existing

    # Column map matching what widgets expect
    column_map = {
        "style_number": "style_number",
        "po_number": "po_number",
        "production_date": "production_date",
        "shift": "shift",
        "actual_qty": "actual_qty",
        "planned_qty": "planned_qty",
        "sam": "sam",
        "operators_present": "operators_present",
        "helpers_present": "helpers_present",
        "worked_minutes": "worked_minutes",
        "downtime_minutes": "downtime_minutes",
        "downtime_reason": "downtime_reason",
        "defects": "defects",
    }

    mapping = SchemaMapping(
        data_source_id=data_source.id,
        version=1,
        is_active=True,
        column_map=column_map,
        reviewed_by_user=True,
        user_corrected=False,
        correction_count=0,
    )
    db.add(mapping)
    await db.flush()

    print(f"📋 Created schema mapping (ID: {mapping.id})")
    return mapping


async def create_staging_records(
    db: AsyncSession,
    raw_import: RawImport,
    runs_data: list[dict],
) -> None:
    """Create staging records to mimic the process step of ingestion."""
    import json as json_lib

    for i, run_data in enumerate(runs_data):
        run = run_data["run"]
        style = run_data["style"]
        order = run_data["order"]

        record_data = {
            "style_number": style.style_number,
            "po_number": order.po_number,
            "production_date": str(run.production_date),
            "shift": run.shift,
            "actual_qty": run_data["actual_qty"],
            "planned_qty": run.planned_qty,
            "sam": float(run_data["sam"]) if run_data["sam"] else None,
            "operators_present": run.operators_present,
            "helpers_present": run.helpers_present,
            "worked_minutes": float(run.worked_minutes) if run.worked_minutes else None,
            "downtime_minutes": run.downtime_minutes,
            "downtime_reason": run.downtime_reason,
        }

        staging = StagingRecord(
            raw_import_id=raw_import.id,
            source_row_number=i + 1,
            status="promoted",  # Already promoted since we created runs
            record_data=json_lib.dumps(record_data),
            promoted_at=datetime.now(timezone.utc),
            promoted_to_table="production_runs",
            promoted_record_id=run.id,
        )
        db.add(staging)

    await db.flush()
    print(f"📊 Created {len(runs_data)} staging records")


async def create_workforce_data(
    db: AsyncSession,
    factory: Factory,
    line: ProductionLine,
    runs_data: list[dict],
) -> None:
    """Create Worker and ProductionOutput records for Lowest Performers widget."""

    # Worker names for test data
    worker_names = [
        "Ahmed Hassan",
        "Fatima Ali",
        "Mohamed Ibrahim",
        "Layla Hassan",
        "Omar Mahmoud",
    ]

    # Check if workers already exist for this factory
    result = await db.execute(select(Worker).where(Worker.factory_id == factory.id))
    existing_workers = result.scalars().all()

    if existing_workers:
        print(
            f"👥 Workers already exist for factory, using existing {len(existing_workers)} workers"
        )
        workers = existing_workers[:5]  # Use first 5
    else:
        # Create 5 workers
        workers = []
        for i, name in enumerate(worker_names):
            worker = Worker(
                factory_id=factory.id,
                line_id=line.id,
                employee_id=f"EMP-{i + 1:03d}",
                full_name=name,
                department="Sewing",
                job_title="Sewing Operator",
                primary_skill="Assembly",
                is_active=True,
            )
            db.add(worker)
            workers.append(worker)
        await db.flush()
        print(f"👥 Created {len(workers)} workers")

    # Check if production outputs already exist
    if runs_data:
        run_ids = [r["run"].id for r in runs_data]
        output_result = await db.execute(
            select(ProductionOutput).where(
                ProductionOutput.production_run_id.in_(run_ids)
            )
        )
        existing_outputs = output_result.scalars().all()
        if existing_outputs:
            print("📊 Production outputs already exist for runs")
            return

    # Create production outputs with varying efficiency
    operations = ["Collar Attach", "Sleeve Set", "Side Seam", "Hemming", "Button Fix"]
    total_outputs = 0

    for run_data in runs_data:
        random.seed(RANDOM_SEED + hash(run_data["run"].id) % 1000)

        for i, worker in enumerate(workers):
            # Vary efficiency: some workers perform better than others
            base_efficiency = 65 + (i * 5)  # 65%, 70%, 75%, 80%, 85%
            efficiency = Decimal(
                str(random.uniform(base_efficiency - 10, base_efficiency + 10))
            )
            pieces = random.randint(20, 60)

            output = ProductionOutput(
                production_run_id=run_data["run"].id,
                worker_id=worker.id,
                operation=operations[i % len(operations)],
                pieces_completed=pieces,
                sam_earned=Decimal(str(pieces)) * run_data["sam"],
                minutes_worked=Decimal("60"),  # 1 hour per record
                efficiency_pct=efficiency,
                recorded_at=datetime.now(timezone.utc),
            )
            db.add(output)
            total_outputs += 1

    await db.flush()
    print(f"📊 Created {total_outputs} production outputs for Lowest Performers widget")


async def create_styles_and_orders(
    db: AsyncSession, factory: Factory
) -> list[tuple[Style, Order]]:
    """Create styles and their associated orders."""

    results = []

    for config in STYLE_CONFIGS[:NUM_STYLES]:
        # Check for existing style
        style_result = await db.execute(
            select(Style).where(
                Style.factory_id == factory.id, Style.style_number == config["code"]
            )
        )
        style = style_result.scalar_one_or_none()

        if not style:
            style = Style(
                factory_id=factory.id,
                style_number=config["code"],
                style_name=config["name"],
                base_sam=config["sam"],
                buyer="Test Buyer",
                is_active=True,
            )
            db.add(style)
            await db.flush()
            print(f"👕 Created style: {style.style_number}")

        # Check for existing order
        po_number = f"PO-TEST-{config['code'][-4:]}"
        order_result = await db.execute(
            select(Order).where(
                Order.style_id == style.id, Order.po_number == po_number
            )
        )
        order = order_result.scalar_one_or_none()

        if not order:
            order = Order(
                style_id=style.id,
                po_number=po_number,
                quantity=config["order_qty"],
                status="sewing",
                priority="normal",
            )
            db.add(order)
            await db.flush()
            print(f"📋 Created order: {order.po_number} (qty: {order.quantity})")

        results.append((style, order))

    return results


async def generate_production_runs(
    db: AsyncSession,
    factory: Factory,
    line: ProductionLine,
    styles_orders: list[tuple[Style, Order]],
    factory_tz: ZoneInfo,
    raw_import: RawImport,
) -> list[dict]:
    """Generate production run records for the last HISTORICAL_DAYS in factory timezone."""

    # Get today in factory timezone
    now_utc = datetime.now(timezone.utc)
    factory_now = now_utc.astimezone(factory_tz)
    today_factory = factory_now.date()

    # Calculate date range (last 90 days)
    start_date = today_factory - timedelta(days=HISTORICAL_DAYS)

    print(
        f"\n📅 Generating {HISTORICAL_DAYS} days of data: {start_date} to {today_factory} ({FACTORY_TIMEZONE})"
    )

    runs_data = []
    total_created = 0
    total_skipped = 0

    # Generate runs for each day
    for day_offset in range(HISTORICAL_DAYS + 1):  # Include today
        current_date = start_date + timedelta(days=day_offset)

        # Skip weekends (Friday/Saturday in Egypt, or Saturday/Sunday elsewhere)
        # For Egypt (Africa/Cairo), weekend is Friday (4) and Saturday (5)
        if current_date.weekday() in [4, 5]:  # Friday=4, Saturday=5
            continue

        # Don't generate future data
        if current_date > today_factory:
            continue

        for i, (style, order) in enumerate(styles_orders):
            # Use date + style index as seed for reproducible but varying data
            day_seed = RANDOM_SEED + day_offset * 100 + i
            random.seed(day_seed)

            # Generate realistic values with daily variance
            base_planned = 200
            # Add some weekly trends (efficiency dips on Sundays/Mondays)
            weekday_factor = 1.0 if current_date.weekday() not in [0, 6] else 0.9

            planned_qty = int(random.randint(150, 300) * weekday_factor)
            # Efficiency varies: 70-110% of planned
            efficiency_factor = random.uniform(0.70, 1.10)
            actual_qty = int(planned_qty * efficiency_factor)

            operators = random.randint(10, 15)
            helpers = random.randint(2, 5)
            worked_minutes = Decimal("480")  # 8 hour shift

            # Downtime increases on certain days
            downtime_base = (
                15 if current_date.weekday() == 0 else 0
            )  # More downtime on Sundays
            downtime_mins = random.randint(downtime_base, downtime_base + 45)
            downtime_reason = (
                random.choice(DOWNTIME_REASONS) if downtime_mins > 0 else None
            )

            # Check for existing run (idempotent)
            run_result = await db.execute(
                select(ProductionRun).where(
                    ProductionRun.factory_id == factory.id,
                    ProductionRun.line_id == line.id,
                    ProductionRun.order_id == order.id,
                    ProductionRun.production_date == current_date,
                )
            )
            run = run_result.scalar_one_or_none()

            if run:
                total_skipped += 1
                runs_data.append(
                    {
                        "run": run,
                        "style": style,
                        "order": order,
                        "actual_qty": run.actual_qty,
                        "sam": run.sam,
                        "production_date": current_date,
                    }
                )
                continue

            run = ProductionRun(
                factory_id=factory.id,
                line_id=line.id,
                order_id=order.id,
                source_import_id=raw_import.id,
                production_date=current_date,
                shift="day",
                planned_qty=planned_qty,
                actual_qty=actual_qty,
                sam=style.base_sam,
                operators_present=operators,
                helpers_present=helpers,
                worked_minutes=worked_minutes,
                downtime_minutes=downtime_mins,
                downtime_reason=downtime_reason,
            )
            db.add(run)
            await db.flush()  # Flush to get run.id for efficiency metric

            # Create efficiency metric
            available_mins = worked_minutes * (operators + helpers)
            earned_mins = Decimal(str(actual_qty)) * style.base_sam
            eff_pct = (
                (earned_mins / available_mins * 100)
                if available_mins > 0
                else Decimal("0")
            )

            metric = EfficiencyMetric(
                production_run_id=run.id,
                efficiency_pct=eff_pct,
                sam_target=Decimal(str(planned_qty)) * style.base_sam,
                sam_actual=earned_mins,
                calculated_at=datetime.now(timezone.utc),
            )
            db.add(metric)

            runs_data.append(
                {
                    "run": run,
                    "style": style,
                    "order": order,
                    "actual_qty": actual_qty,
                    "sam": style.base_sam,
                    "production_date": current_date,
                }
            )
            total_created += 1

        # Flush every 10 days to avoid large transaction
        if day_offset % 10 == 0 and day_offset > 0:
            await db.flush()

    await db.flush()
    print(
        f"📈 Created {total_created} production runs ({total_skipped} already existed)"
    )
    return runs_data


async def generate_production_events(
    db: AsyncSession,
    line: ProductionLine,
    styles_orders: list[tuple[Style, Order]],
    runs_data: list[dict],
    factory_tz: ZoneInfo,
):
    """Generate hourly production events for last 7 days only (for performance)."""

    # Get today in factory timezone
    now_utc = datetime.now(timezone.utc)
    factory_now = now_utc.astimezone(factory_tz)
    today_factory = factory_now.date()

    # Only generate detailed events for last 7 days (performance optimization)
    event_cutoff_date = today_factory - timedelta(days=7)

    # Filter runs to only those within event window
    recent_runs = [
        r
        for r in runs_data
        if r.get("production_date", today_factory) >= event_cutoff_date
    ]

    if not recent_runs:
        print("\n⏰ No recent runs to generate events for")
        return

    print(
        f"\n⏰ Generating hourly production events for last 7 days ({len(recent_runs)} runs)..."
    )

    total_events = 0

    for run_data in recent_runs:
        run = run_data["run"]
        style = run_data["style"]
        order = run_data["order"]
        total_qty = run_data["actual_qty"]
        production_date = run_data.get("production_date", today_factory)

        # Check if events already exist for this run
        existing_result = await db.execute(
            select(ProductionEvent)
            .where(ProductionEvent.production_run_id == run.id)
            .limit(1)
        )
        if existing_result.scalar_one_or_none():
            continue  # Skip if events already exist

        # Distribute quantity across hours
        qty_per_hour = total_qty // len(PRODUCTION_HOURS)
        remainder = total_qty % len(PRODUCTION_HOURS)

        for h_idx, hour in enumerate(PRODUCTION_HOURS):
            random.seed(RANDOM_SEED + h_idx + hash(str(run.id)))

            # Add remainder to first hour
            hour_qty = qty_per_hour + (remainder if h_idx == 0 else 0)

            # Create fewer events per hour for historical data (3-5)
            num_events = random.randint(3, 5)
            qty_per_event = hour_qty // num_events
            event_remainder = hour_qty % num_events

            for e_idx in range(num_events):
                minute = random.randint(0, 59)
                second = random.randint(0, 59)

                # Create timestamp for the specific production date
                event_time_factory = datetime(
                    production_date.year,
                    production_date.month,
                    production_date.day,
                    hour,
                    minute,
                    second,
                    tzinfo=factory_tz,
                )
                event_time_utc = event_time_factory.astimezone(timezone.utc).replace(
                    tzinfo=None
                )

                # Don't create events in the future
                if event_time_factory > factory_now:
                    continue

                event_qty = qty_per_event + (1 if e_idx < event_remainder else 0)
                if event_qty <= 0:
                    continue

                event = ProductionEvent(
                    timestamp=event_time_utc,
                    event_type=EventType.BATCH_UPLOAD,
                    quantity=event_qty,
                    line_id=line.id,
                    order_id=order.id,
                    style_id=style.id,
                    production_run_id=run.id,
                )
                db.add(event)
                total_events += 1

    await db.flush()
    print(f"⏰ Created {total_events} production events")


async def generate_quality_data(
    db: AsyncSession,
    runs_data: list[dict],
):
    """Generate quality inspection data for DHU widget."""

    print("\n🔍 Generating quality inspection data...")

    for run_data in runs_data:
        run = run_data["run"]
        actual_qty = run_data["actual_qty"]

        # Check if inspection exists
        result = await db.execute(
            select(QualityInspection).where(
                QualityInspection.production_run_id == run.id
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            continue

        # Generate defects (1-5% defect rate)
        random.seed(RANDOM_SEED + hash(run.id))
        defect_rate = random.uniform(0.01, 0.05)
        defects = int(actual_qty * defect_rate)

        # Calculate DHU (defects per hundred units)
        dhu = Decimal(str((defects / actual_qty * 100) if actual_qty > 0 else 0))

        inspection = QualityInspection(
            production_run_id=run.id,
            units_checked=actual_qty,
            defects_found=defects,
            dhu=dhu,
            inspected_at=datetime.now(timezone.utc),
        )
        db.add(inspection)

        print(
            f"🔍 Created inspection for run: inspected={actual_qty}, defects={defects}, DHU={dhu:.2f}%"
        )

    await db.flush()


async def generate_dhu_reports(
    db: AsyncSession,
    factory: Factory,
    runs_data: list[dict],
):
    """Generate daily DHU reports for the factory based on quality inspections."""

    print("\n📊 Generating daily DHU reports...")

    # Group runs by date
    from collections import defaultdict

    runs_by_date = defaultdict(list)
    for run_data in runs_data:
        runs_by_date[run_data["production_date"]].append(run_data)

    generated_count = 0

    for report_date, daily_runs in runs_by_date.items():
        # Check if report exists
        from app.enums import PeriodType

        result = await db.execute(
            select(DHUReport).where(
                DHUReport.factory_id == factory.id,
                DHUReport.report_date == report_date,
                DHUReport.period_type == PeriodType.DAILY,
            )
        )
        if result.scalar_one_or_none():
            continue

        # Calculate aggregates
        total_inspected = 0
        total_defects = 0

        for run_data in daily_runs:
            run = run_data["run"]
            actual_qty = run_data["actual_qty"]

            # Re-derive defects using deterministic seed (same as generate_quality_data)
            random.seed(RANDOM_SEED + hash(run.id))
            defect_rate = random.uniform(0.01, 0.05)
            defects = int(actual_qty * defect_rate)

            total_inspected += actual_qty
            total_defects += defects

        if total_inspected == 0:
            continue

        avg_dhu = Decimal(str(total_defects / total_inspected * 100))

        report = DHUReport(
            factory_id=factory.id,
            report_date=report_date,
            period_type=PeriodType.DAILY,
            avg_dhu=avg_dhu,
            min_dhu=avg_dhu * Decimal("0.8"),
            max_dhu=avg_dhu * Decimal("1.2"),
            total_inspected=total_inspected,
            total_defects=total_defects,
            total_rejected=int(total_defects * 0.1),
            dhu_change_pct=Decimal("0"),
            trend_direction="stable",
            created_at=datetime.now(timezone.utc),
        )
        db.add(report)
        generated_count += 1

    await db.flush()
    print(f"📊 Created {generated_count} daily DHU reports")


async def create_dashboard(
    db: AsyncSession,
    user: User,
    data_source: DataSource,
    line: ProductionLine,
) -> Dashboard:
    """Create a dashboard with all widgets enabled."""

    today = date.today().isoformat()
    dashboard_name = f"{DASHBOARD_NAME} - {today}"

    # Check if exists
    result = await db.execute(
        select(Dashboard).where(
            Dashboard.user_id == user.id, Dashboard.name == dashboard_name
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        print(f"📊 Dashboard already exists: {dashboard_name}")
        return existing

    # Widget configuration with all 13 widgets
    import json

    widget_config = json.dumps(
        {
            "enabled_widgets": [
                "overview",
                "production_hourly",
                "earned_minutes",
                "workforce",
                "target_realization",
                "style_progress",
                "dhu_history",
                "speed_quality",
                "downtime_reasons",
                "complexity_analysis",
                "sam_performance",
                "lowest_performers",
                "production_events",
            ],
            "widget_settings": {},
        }
    )

    # Default layout
    layout_config = json.dumps(
        {
            "layouts": [
                {"widget_id": "overview", "x": 0, "y": 0, "w": 4, "h": 2},
                {"widget_id": "production_hourly", "x": 4, "y": 0, "w": 4, "h": 2},
                {"widget_id": "earned_minutes", "x": 8, "y": 0, "w": 4, "h": 2},
                {"widget_id": "workforce", "x": 0, "y": 2, "w": 3, "h": 2},
                {"widget_id": "target_realization", "x": 3, "y": 2, "w": 3, "h": 2},
                {"widget_id": "style_progress", "x": 6, "y": 2, "w": 6, "h": 2},
            ]
        }
    )

    dashboard = Dashboard(
        user_id=user.id,
        name=dashboard_name,
        description="Auto-generated dashboard for testing all widgets with today's production data",
        data_source_id=data_source.id,
        widget_config=widget_config,
        layout_config=layout_config,
    )
    db.add(dashboard)
    await db.flush()

    print(f"📊 Created dashboard: {dashboard.name} (ID: {dashboard.id})")
    return dashboard


# =============================================================================
# Summary Functions
# =============================================================================


def print_summary(
    factory: Factory,
    line: ProductionLine,
    dashboard: Dashboard,
    runs_data: list[dict],
):
    """Print a summary of generated data with verification info."""

    print("\n" + "=" * 70)
    print("📋 GENERATION SUMMARY")
    print("=" * 70)

    print(f"\n🏭 Factory:       {factory.name}")
    print(f"   ID:            {factory.id}")
    print(f"   Timezone:      {factory.timezone}")

    print(f"\n⚙️  Production Line: {line.name}")
    print(f"   ID:            {line.id}")

    print(f"\n📊 Dashboard:     {dashboard.name}")
    print(f"   ID:            {dashboard.id}")

    # Calculate expected values
    total_actual = sum(r["actual_qty"] for r in runs_data)
    total_earned = sum(Decimal(str(r["actual_qty"])) * r["sam"] for r in runs_data)

    print("\n📈 EXPECTED WIDGET VALUES:")
    print(f"   Total Output:     {total_actual} units")
    print(f"   Earned Minutes:   {total_earned:.2f} mins")
    print(f"   Number of Styles: {len(runs_data)}")

    print("\n🔗 VERIFICATION URLs:")
    print(f"   Frontend Dashboard: http://localhost:5173/dashboards/{dashboard.id}")
    print(
        f"   API Overview:       http://localhost:8000/api/v1/analytics/overview?line_id={line.id}"
    )
    print(
        f"   API Earned Minutes: http://localhost:8000/api/v1/analytics/earned-minutes?line_id={line.id}"
    )
    print(
        f"   API Hourly:         http://localhost:8000/api/v1/analytics/production/hourly?line_id={line.id}"
    )

    print("\n🔐 Login Credentials:")
    print(f"   Email:    {DEMO_USER_EMAIL}")
    print(f"   Password: {DEMO_USER_PASSWORD}")

    print("\n" + "=" * 70)


# =============================================================================
# Main Entry Point
# =============================================================================


async def main(cleanup: bool = False):
    """Main execution function."""

    print("🚀 Production Data Generator")
    print("=" * 70)

    engine = get_async_engine()
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    factory_tz = ZoneInfo(FACTORY_TIMEZONE)

    async with async_session() as db:
        try:
            # Phase 1: Setup
            user, org = await ensure_demo_user(db)

            if cleanup:
                await cleanup_existing_test_data(db, org)

            factory = await create_test_factory(db, org)
            line = await create_production_line(db, factory)
            data_source = await create_data_source(db, line)

            # Create schema mapping (mirrors confirm-mapping step)
            schema_mapping = await create_schema_mapping(db, data_source)

            # Create fake file upload record
            raw_import = await create_raw_import(db, user, factory, line, data_source)

            # Phase 2: Generate Data
            styles_orders = await create_styles_and_orders(db, factory)
            runs_data = await generate_production_runs(
                db, factory, line, styles_orders, factory_tz, raw_import
            )
            await generate_production_events(
                db, line, styles_orders, runs_data, factory_tz
            )
            await generate_quality_data(db, runs_data)
            await generate_dhu_reports(db, factory, runs_data)

            # Create staging records (mirrors process step)
            await create_staging_records(db, raw_import, runs_data)

            # Create workforce data (for Lowest Performers widget)
            await create_workforce_data(db, factory, line, runs_data)

            # Phase 3: Create Dashboard
            dashboard = await create_dashboard(db, user, data_source, line)

            # Commit all changes
            await db.commit()

            # Phase 4: Summary
            print_summary(factory, line, dashboard, runs_data)

            print("\n✅ Generation complete!")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error: {e}")
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate production data for widget testing"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Delete existing test factories before generating new data",
    )

    args = parser.parse_args()

    asyncio.run(main(cleanup=args.cleanup))
