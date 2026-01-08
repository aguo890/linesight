"""
Database seeding utility.
Populates the database with realistic development data for edge case testing.
"""

import hashlib
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.enums import OrderPriority, OrderStatus, RoleScope, UserRole
from app.models.analytics import EfficiencyMetric
from app.models.factory import Factory, ProductionLine
from app.models.production import (
    Order,
    ProductionRun,
    Style,
)
from app.models.user import Organization, User, UserScope
from app.models.workforce import Worker, WorkerSkill


def gravatar_url(email: str) -> str:
    """Generate a Gravatar identicon URL for an email."""
    email_hash = hashlib.md5(email.lower().encode()).hexdigest()
    return f"https://www.gravatar.com/avatar/{email_hash}?d=identicon&s=200"


async def seed_data(db: AsyncSession):
    """Seed the database with initial development data."""

    # 0. Clear existing data for idempotency
    print("Clearing existing seed data for idempotency...")
    await db.execute(delete(EfficiencyMetric))
    await db.execute(delete(ProductionRun))
    await db.execute(delete(UserScope))
    # Delete managers, analysts, viewers only (preserve admin/owner accounts)
    await db.execute(delete(User).where(User.role.in_([UserRole.MANAGER, UserRole.ANALYST, UserRole.VIEWER])))
    await db.execute(delete(ProductionLine))
    await db.execute(delete(Factory))
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

    # 2. Create System Admin User (Platform-level admin - YOU)
    admin_query = select(User).where(User.email == "admin@linesight.dev")
    admin_result = await db.execute(admin_query)
    admin_user = admin_result.scalar_one_or_none()

    if not admin_user:
        admin_user = User(
            organization_id=org.id,
            email="admin@linesight.dev",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role=UserRole.SYSTEM_ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        print(f"Created System Admin User: {admin_user.email}")
    else:
        admin_user.role = UserRole.SYSTEM_ADMIN
        db.add(admin_user)
        print(f"Updated Admin User to SYSTEM_ADMIN: {admin_user.email}")

    # 2.5. Create Demo Organization & User
    print("Checking Demo Organization...")
    demo_org_query = select(Organization).where(Organization.code == "DEMO")
    demo_org_res = await db.execute(demo_org_query)
    demo_org = demo_org_res.scalar_one_or_none()

    if not demo_org:
        print("Creating Demo Organization...")
        demo_org = Organization(
            name="Demo Org",
            code="DEMO",
            primary_email="demo@linesight.io",
            max_factories=10,
            max_lines_per_factory=10,
        )
        db.add(demo_org)
        await db.flush()
    else:
        print("Demo Organization already exists.")
        # Update quotas for testing
        demo_org.max_factories = 10
        demo_org.max_lines_per_factory = 10
        db.add(demo_org)
        await db.flush()

    print("Checking Demo User...")
    demo_user_query = select(User).where(User.email == "demo@linesight.io")
    demo_user_res = await db.execute(demo_user_query)
    demo_user = demo_user_res.scalar_one_or_none()

    if not demo_user:
        print("Creating Demo Owner User...")
        demo_user = User(
            organization_id=demo_org.id,
            email="demo@linesight.io",
            hashed_password=hash_password("demo1234"),
            full_name="Demo Owner",
            role=UserRole.OWNER,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow(),
            avatar_url=gravatar_url("demo@linesight.io"),
        )
        db.add(demo_user)
    else:
        print("Updating Demo User to OWNER role...")
        demo_user.organization_id = demo_org.id
        demo_user.hashed_password = hash_password("demo1234")
        demo_user.role = UserRole.OWNER
        demo_user.full_name = "Demo Owner"
        demo_user.last_login = datetime.utcnow()
        demo_user.avatar_url = gravatar_url("demo@linesight.io")
        db.add(demo_user)

    await db.flush()

    # --------------------------------------------------------------------------
    # 2.6. Create Analyst and Viewer test users (for permission testing)
    # --------------------------------------------------------------------------
    print("\n--- Creating Analyst and Viewer Test Users ---")
    
    # Analyst User - Can view dashboards and create them, but NOT add lines
    analyst_query = select(User).where(User.email == "analyst@linesight.io")
    analyst_result = await db.execute(analyst_query)
    analyst_user = analyst_result.scalar_one_or_none()
    
    if not analyst_user:
        analyst_user = User(
            organization_id=demo_org.id,
            email="analyst@linesight.io",
            hashed_password=hash_password("analyst123"),
            full_name="Data Analyst",
            role=UserRole.ANALYST,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow() - timedelta(hours=6),
            avatar_url=gravatar_url("analyst@linesight.io"),
        )
        db.add(analyst_user)
        print(f"Created Analyst User: {analyst_user.email}")
    else:
        print(f"Analyst User already exists: {analyst_user.email}")
    
    # Viewer User - Read-only, can only view dashboards
    viewer_query = select(User).where(User.email == "viewer@linesight.io")
    viewer_result = await db.execute(viewer_query)
    viewer_user = viewer_result.scalar_one_or_none()
    
    if not viewer_user:
        viewer_user = User(
            organization_id=demo_org.id,
            email="viewer@linesight.io",
            hashed_password=hash_password("viewer123"),
            full_name="Read-Only Viewer",
            role=UserRole.VIEWER,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow() - timedelta(days=1),
            avatar_url=gravatar_url("viewer@linesight.io"),
        )
        db.add(viewer_user)
        print(f"Created Viewer User: {viewer_user.email}")
    else:
        print(f"Viewer User already exists: {viewer_user.email}")
    
    await db.flush()

    # --------------------------------------------------------------------------
    # 2.7. Create Factory Manager test user (for permission testing)
    # --------------------------------------------------------------------------
    print("\n--- Creating Factory Manager Test User ---")
    
    factory_mgr_query = select(User).where(User.email == "factory.manager@linesight.io")
    factory_mgr_result = await db.execute(factory_mgr_query)
    factory_mgr_user = factory_mgr_result.scalar_one_or_none()
    
    if not factory_mgr_user:
        factory_mgr_user = User(
            organization_id=demo_org.id,
            email="factory.manager@linesight.io",
            hashed_password=hash_password("factorymgr123"),
            full_name="Factory Manager",
            role=UserRole.FACTORY_MANAGER,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow() - timedelta(hours=2),
            avatar_url=gravatar_url("factory.manager@linesight.io"),
        )
        db.add(factory_mgr_user)
        print(f"Created Factory Manager: {factory_mgr_user.email}")
    else:
        print(f"Factory Manager already exists: {factory_mgr_user.email}")
    
    # --------------------------------------------------------------------------
    # 2.8. Create Line Manager test user (for strict access testing)
    # LINE MANAGER: Can ONLY view/upload to assigned lines, NOT siblings
    # --------------------------------------------------------------------------
    print("\n--- Creating Line Manager Test User ---")
    
    line_mgr_query = select(User).where(User.email == "line.manager@linesight.io")
    line_mgr_result = await db.execute(line_mgr_query)
    line_mgr_user = line_mgr_result.scalar_one_or_none()
    
    if not line_mgr_user:
        line_mgr_user = User(
            organization_id=demo_org.id,
            email="line.manager@linesight.io",
            hashed_password=hash_password("linemgr123"),
            full_name="Line Manager",
            role=UserRole.LINE_MANAGER,
            is_active=True,
            is_verified=True,
            last_login=datetime.utcnow() - timedelta(hours=4),
            avatar_url=gravatar_url("line.manager@linesight.io"),
        )
        db.add(line_mgr_user)
        print(f"Created Line Manager: {line_mgr_user.email}")
    else:
        print(f"Line Manager already exists: {line_mgr_user.email}")
    
    await db.flush()

    # =========================================================================
    # 3. CREATE TEST FACTORIES (3 total for edge case testing)
    # =========================================================================
    print("\n--- Creating Test Factories ---")

    # Factory A: Detroit Plant (fully populated, 5 lines with human names)
    factory_a = Factory(
        organization_id=demo_org.id,
        name="Detroit Plant",
        code="FAC-DETROIT",
        country="US",
        city="Detroit",
        timezone="America/Detroit",
        total_workers=250,
        is_active=True,
    )
    db.add(factory_a)
    await db.flush()
    print(f"Created Factory A: {factory_a.name}")

    # Detroit lines with proper human names
    detroit_line_names = ["Chassis Assembly", "Paint Shop", "Final Assembly", "Quality Control", "Packaging"]
    detroit_lines = []
    for i, name in enumerate(detroit_line_names, start=1):
        line = ProductionLine(
            factory_id=factory_a.id,
            name=name,
            code=f"DET-L{i:02d}",
            is_active=True,
            target_efficiency_pct=85,
        )
        db.add(line)
        detroit_lines.append(line)
    await db.flush()
    print(f"  Created {len(detroit_lines)} production lines for Detroit Plant")

    # Factory B: Shanghai Prototype (messy - 2 UUID names, 1 proper name)
    factory_b = Factory(
        organization_id=demo_org.id,
        name="Shanghai Prototype",
        code="FAC-SHANGHAI",
        country="CN",
        city="Shanghai",
        timezone="Asia/Shanghai",
        total_workers=80,
        is_active=True,
    )
    db.add(factory_b)
    await db.flush()
    print(f"Created Factory B: {factory_b.name}")

    # Shanghai lines - 2 with UUID names (simulating drag-drop created), 1 with proper name
    shanghai_lines = []
    # Proper named line
    proper_line = ProductionLine(
        factory_id=factory_b.id,
        name="Prototype Assembly",
        code="SH-L01",
        is_active=True,
        target_efficiency_pct=75,
    )
    db.add(proper_line)
    shanghai_lines.append(proper_line)

    # UUID-named lines (simulate unconfigured lines from drag-drop)
    for i in range(2):
        uuid_name = str(uuid.uuid4())
        line = ProductionLine(
            factory_id=factory_b.id,
            name=uuid_name,  # Raw UUID as name - should show "Untitled Line" in UI
            code=f"SH-UUID-{i+1}",
            is_active=True,
            target_efficiency_pct=70,
        )
        db.add(line)
        shanghai_lines.append(line)
    await db.flush()
    print(f"  Created {len(shanghai_lines)} production lines for Shanghai (2 with UUID names)")

    # Factory C: Empty Shell (0 lines - edge case for empty states)
    factory_c = Factory(
        organization_id=demo_org.id,
        name="Empty Shell",
        code="FAC-EMPTY",
        country="MX",
        city="Monterrey",
        timezone="America/Monterrey",
        total_workers=0,
        is_active=True,
    )
    db.add(factory_c)
    await db.flush()
    print(f"Created Factory C: {factory_c.name} (0 production lines - empty state)")

    # Collect all lines for assignment logic
    all_lines = detroit_lines + shanghai_lines

    # =========================================================================
    # 4. CREATE DIVERSE USER ROSTER (Visual Stress Testing)
    # =========================================================================
    print("\n--- Creating Diverse User Roster ---")
    now = datetime.utcnow()
    managers_created = 0
    scopes_created = 0

    # Helper to create manager and return
    async def create_manager(
        email: str,
        full_name: str,
        last_login: datetime | None,
        avatar_url: str | None,
        is_active: bool = True,
    ) -> User:
        user = User(
            organization_id=demo_org.id,
            email=email,
            hashed_password=hash_password("manager123"),
            full_name=full_name,
            role=UserRole.MANAGER,
            is_active=is_active,
            is_verified=True,
            last_login=last_login,
            avatar_url=avatar_url,
        )
        db.add(user)
        return user

    # --- 1. Standard Managers (5) with realistic names, varied login times ---
    standard_managers = [
        ("emily.chen@linesight.io", "Emily Chen", now - timedelta(hours=2)),
        ("marcus.johnson@linesight.io", "Marcus Johnson", now - timedelta(days=1)),
        ("sofia.rodriguez@linesight.io", "Sofia Rodriguez", now - timedelta(days=3)),
        ("james.williams@linesight.io", "James Williams", now - timedelta(days=7)),
        ("aisha.patel@linesight.io", "Aisha Patel", now - timedelta(days=14)),
    ]

    for email, name, last_login in standard_managers:
        user = await create_manager(email, name, last_login, gravatar_url(email))
        await db.flush()
        managers_created += 1
        # Assign to random Detroit line (1-2 lines each)
        line_idx = managers_created % len(detroit_lines)
        scope = UserScope(
            user_id=user.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_a.id,
            production_line_id=detroit_lines[line_idx].id,
            role=UserRole.MANAGER,
        )
        db.add(scope)
        scopes_created += 1
    print(f"  Created 5 Standard Managers")

    # --- 2. The "UI Breaker" - exceptionally long name ---
    ui_breaker = await create_manager(
        "christopher.montgomery@linesight.io",
        "Christopher-James Montgomery-Smythe III, PhD, MBA",
        now - timedelta(days=5),
        gravatar_url("christopher.montgomery@linesight.io"),
    )
    await db.flush()
    managers_created += 1
    scope = UserScope(
        user_id=ui_breaker.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_a.id,
        production_line_id=detroit_lines[0].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    print(f"  Created 'UI Breaker' with long name")

    # --- 3. The "Ghost" - never logged in, no avatar ---
    ghost = await create_manager(
        "ghost.user@linesight.io",
        "Ghost User",
        None,  # Never logged in
        None,  # No avatar
    )
    await db.flush()
    managers_created += 1
    scope = UserScope(
        user_id=ghost.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_a.id,
        production_line_id=detroit_lines[1].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    print(f"  Created 'Ghost' user (never logged in, no avatar)")

    # --- 4. The "Stale" User - 90+ days since login ---
    stale = await create_manager(
        "stale.user@linesight.io",
        "Stale User",
        now - timedelta(days=92),  # 3 months ago
        gravatar_url("stale.user@linesight.io"),
    )
    await db.flush()
    managers_created += 1
    scope = UserScope(
        user_id=stale.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_a.id,
        production_line_id=detroit_lines[2].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    print(f"  Created 'Stale' user (last login 92 days ago)")

    # --- 5. The "Suspended" User - is_active=False ---
    suspended = await create_manager(
        "suspended.user@linesight.io",
        "Suspended User",
        now - timedelta(days=30),
        gravatar_url("suspended.user@linesight.io"),
        is_active=False,  # SUSPENDED!
    )
    await db.flush()
    managers_created += 1
    scope = UserScope(
        user_id=suspended.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_a.id,
        production_line_id=detroit_lines[3].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    print(f"  Created 'Suspended' user (is_active=False)")

    # --- 6. The "Super Manager" - assigned to ALL lines in ALL factories ---
    super_manager = await create_manager(
        "super.manager@linesight.io",
        "Super Manager",
        now - timedelta(hours=1),  # Very active
        gravatar_url("super.manager@linesight.io"),
    )
    await db.flush()
    managers_created += 1
    for line in all_lines:
        factory_id = factory_a.id if line in detroit_lines else factory_b.id
        scope = UserScope(
            user_id=super_manager.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_id,
            production_line_id=line.id,
            role=UserRole.MANAGER,
        )
        db.add(scope)
        scopes_created += 1
    print(f"  Created 'Super Manager' (assigned to ALL {len(all_lines)} lines)")

    # --- 7. The "Unassigned" Pool - 2 managers with NO scopes ---
    unassigned_names = [
        ("unassigned.one@linesight.io", "Unassigned Manager One"),
        ("unassigned.two@linesight.io", "Unassigned Manager Two"),
    ]
    for email, name in unassigned_names:
        user = await create_manager(email, name, now - timedelta(days=10), gravatar_url(email))
        await db.flush()
        managers_created += 1
        # NO SCOPES - they are in the org but assigned to nothing
    print(f"  Created 2 'Unassigned' managers (no scopes)")

    # --- 8. The "Cross-Pollinated" Manager - assigned to BOTH Detroit AND Shanghai ---
    cross_pollinated = await create_manager(
        "cross.factory@linesight.io",
        "Cross-Factory Manager",
        now - timedelta(days=2),
        gravatar_url("cross.factory@linesight.io"),
    )
    await db.flush()
    managers_created += 1
    # Assign to Detroit line
    scope = UserScope(
        user_id=cross_pollinated.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_a.id,
        production_line_id=detroit_lines[0].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    # Also assign to Shanghai line
    scope = UserScope(
        user_id=cross_pollinated.id,
        scope_type=RoleScope.LINE,
        organization_id=demo_org.id,
        factory_id=factory_b.id,
        production_line_id=shanghai_lines[0].id,
        role=UserRole.MANAGER,
    )
    db.add(scope)
    scopes_created += 1
    print(f"  Created 'Cross-Pollinated' manager (Detroit + Shanghai)")

    # --- 9. Extra Managers for "Overcrowded Line" (Chassis Assembly gets 5+ managers) ---
    overcrowd_chassis_managers = [
        ("chassis.lead@linesight.io", "Chassis Lead"),
        ("chassis.assistant@linesight.io", "Chassis Assistant"),
        ("chassis.supervisor@linesight.io", "Chassis Supervisor"),
    ]
    chassis_line = detroit_lines[0]  # Chassis Assembly
    for email, name in overcrowd_chassis_managers:
        user = await create_manager(email, name, now - timedelta(days=4), gravatar_url(email))
        await db.flush()
        managers_created += 1
        scope = UserScope(
            user_id=user.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_a.id,
            production_line_id=chassis_line.id,
            role=UserRole.MANAGER,
        )
        db.add(scope)
        scopes_created += 1
    print(f"  Created 3 extra managers for 'Overcrowded Line' (Chassis Assembly)")

    await db.flush()
    print(f"\nTotal: Created {managers_created} managers with {scopes_created} scope assignments")

    # =========================================================================
    # 5. CREATE STYLES AND ORDERS (for production data)
    # =========================================================================
    print("\n--- Creating Styles and Orders ---")
    
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
                factory_id=factory_a.id,
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
    print(f"Created {len(styles)} styles and {len(orders)} orders")

    # =========================================================================
    # 6. CREATE WORKERS (for Detroit Plant)
    # =========================================================================
    print("\n--- Creating Workers ---")
    
    worker_names = ["Thao Nguyen", "Minh Tran", "Hoa Pham", "Dung Le", "Anh Vu"]
    workers = []
    for i, name in enumerate(worker_names):
        emp_id = f"W-{100 + i}"
        worker_query = select(Worker).where(Worker.employee_id == emp_id)
        worker_result = await db.execute(worker_query)
        worker = worker_result.scalar_one_or_none()

        if not worker:
            worker = Worker(
                factory_id=factory_a.id,
                employee_id=emp_id,
                full_name=name,
                line_id=detroit_lines[i % len(detroit_lines)].id,
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
    print(f"Created {len(workers)} workers")

    # =========================================================================
    # 7. CREATE HISTORICAL PRODUCTION RUNS (Last 7 days for Detroit)
    # =========================================================================
    print("\n--- Creating Historical Production Runs ---")
    
    today = date.today()
    runs_created = 0
    for d in range(7):
        target_date = today - timedelta(days=d)
        for line in detroit_lines:
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
                    factory_id=factory_a.id,
                    production_date=target_date,
                    order_id=order.id,
                    line_id=line.id,
                    planned_qty=planned,
                    actual_qty=actual,
                    worked_minutes=Decimal("480"),
                    operators_present=20,
                    sam=style.base_sam,
                )
                db.add(run)
                await db.flush()
                runs_created += 1

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

    await db.commit()
    print(f"Created {runs_created} production runs with efficiency metrics")
    print("\n=== Database seeding completed successfully! ===")
    print(f"""
Summary:
  - 3 Factories (Detroit, Shanghai, Empty Shell)
  - {len(detroit_lines)} Detroit lines + {len(shanghai_lines)} Shanghai lines
  - {managers_created} diverse managers with {scopes_created} scope assignments
  - Edge cases: Ghost, Stale, Suspended, Super Manager, Unassigned, Cross-Factory
  - Overcrowded line: Chassis Assembly (5+ managers)
  - 2 UUID-named lines in Shanghai (for 'Untitled Line' UI testing)
""")
