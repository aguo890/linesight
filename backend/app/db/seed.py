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
from app.models.factory import Factory
from app.models.datasource import DataSource as ProductionLine, SchemaMapping
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

    # 0. Clear existing data for idempotency (Strict Reverse-Dependency Order)
    print("Clearing existing seed data for idempotency...")
    
    # 1. Metrics & Logs
    await db.execute(delete(EfficiencyMetric))
    
    # 2. Production Data
    await db.execute(delete(ProductionRun))
    await db.execute(delete(WorkerSkill))
    await db.execute(delete(Worker))
    await db.execute(delete(Order))
    await db.execute(delete(Style))
    
    # 3. Configuration & Relations
    await db.execute(delete(SchemaMapping))
    await db.execute(delete(UserScope))
    
    # 4. Core Structure
    await db.execute(delete(ProductionLine))
    
    # 5. Organizations (Factories)
    await db.execute(delete(Factory))
    
    # 6. Users (Keep System Admin & Owner if possible, but for full reset we often clear all except maybe admin)
    # For this seed script, we'll clear dependent roles
    await db.execute(delete(User).where(User.role.in_([
        UserRole.FACTORY_MANAGER, 
        UserRole.LINE_MANAGER, 
        UserRole.ANALYST, 
        UserRole.VIEWER
    ])))
    
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

    # Detroit lines: 5 named + 10 generic
    detroit_lines = []
    # 5 Specific named lines
    detroit_line_names = ["Chassis Assembly", "Paint Shop", "Final Assembly", "Quality Control", "Packaging"]
    for i, name in enumerate(detroit_line_names, start=1):
        line = ProductionLine(
            factory_id=factory_a.id,
            name=name,
            source_name=name,
            code=f"DET-L{i:02d}",
            is_active=True,
            target_efficiency_pct=85,
        )
        # Golden Path Configuration for Chassis Assembly (DET-L01)
        if i == 1:
            line.time_column = "Date"
            line.settings = {"allow_overwrites": True, "match_strategy": "fuzzy"}
            line.source_name = "chassis_production_2025.xlsx"
            
        db.add(line)
        await db.flush() # Flush to get the ID
        
        # Create SchemaMapping for Chassis Assembly
        if i == 1:
            mapping = SchemaMapping(
                data_source_id=line.id,
                column_map={
                    "Date": "production_date", 
                    "Style": "style_number", 
                    "Qty": "actual_qty", 
                    "Efficiency": "efficiency_pct"
                },
                is_active=True,
                version=1
            )
            db.add(mapping)
            
        detroit_lines.append(line)
    
    # 10 Generic lines
    for i in range(6, 16):
        line = ProductionLine(
            factory_id=factory_a.id,
            name=f"Assembly Line {i}",
            source_name=f"Assembly Line {i}",
            code=f"DET-L{i:02d}",
            is_active=True,
            target_efficiency_pct=80,
        )
        db.add(line)
        detroit_lines.append(line)
        
    await db.flush()
    print(f"  Created {len(detroit_lines)} production lines for Detroit Plant (5 specific + 10 generic)")

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

    # Shanghai lines: 1 named + 2 UUID + 12 generic
    shanghai_lines = []
    # Proper named line
    proper_line = ProductionLine(
        factory_id=factory_b.id,
        name="Prototype Assembly",
        source_name="Prototype Assembly",
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
            source_name=uuid_name,
            code=f"SH-UUID-{i+1}",
            is_active=True,
            target_efficiency_pct=70,
        )
        db.add(line)
        shanghai_lines.append(line)
        
    # 12 Generic lines
    for i in range(4, 16):
        line = ProductionLine(
            factory_id=factory_b.id,
            name=f"Shanghai Line {i}",
            source_name=f"Shanghai Line {i}",
            code=f"SH-L{i:02d}",
            is_active=True,
            target_efficiency_pct=72,
        )
        db.add(line)
        shanghai_lines.append(line)

    await db.flush()
    print(f"  Created {len(shanghai_lines)} production lines for Shanghai (15 total: 1 named, 2 UUID, 12 generic)")

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

    # Assign Scopes to Test Managers (MOVED HERE to ensure factories exist)
    # Factory Manager -> Detroit Plant
    fm_scope_query = select(UserScope).where(UserScope.user_id == factory_mgr_user.id)
    fm_scope_res = await db.execute(fm_scope_query)
    if not fm_scope_res.scalar_one_or_none():
        db.add(UserScope(
            user_id=factory_mgr_user.id,
            scope_type=RoleScope.FACTORY,
            organization_id=demo_org.id,
            factory_id=factory_a.id,
            role=UserRole.FACTORY_MANAGER
        ))

    # Line Manager -> Detroit Line 1 (Chassis Assembly)
    lm_scope_query = select(UserScope).where(UserScope.user_id == line_mgr_user.id)
    lm_scope_res = await db.execute(lm_scope_query)
    if not lm_scope_res.scalar_one_or_none():
        db.add(UserScope(
            user_id=line_mgr_user.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_a.id,
            data_source_id=detroit_lines[0].id,
            role=UserRole.LINE_MANAGER
        ))
    
    await db.flush()

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
        role: UserRole = UserRole.FACTORY_MANAGER,
    ) -> User:
        # Check if exists first (Idempotency)
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            # OPTIONAL: Update role if it doesn't match? 
            # For now, let's assume we want to correct it if it's wrong in this session, 
            # but usually we just return existing. 
            # If we want to fix existing bad data from previous runs, we might want to update it.
            if existing.role != role:
                existing.role = role
                db.add(existing)
            return existing

        user = User(
            organization_id=demo_org.id,
            email=email,
            hashed_password=hash_password("manager123"),
            full_name=full_name,
            role=role,
            is_active=is_active,
            is_verified=True,
            last_login=last_login,
            avatar_url=avatar_url,
        )
        db.add(user)
        return user

    # --- Refactored: Specific Manager Distribution (Detroit) ---
    # Goal: 2 Factory Managers, 2-3 Line Managers per Line

    # Track manager counts per line to ensure 1-2 per line
    line_manager_counts = {line.id: 0 for line in all_lines}

    # 1. Factory Managers (2)
    detroit_fm_configs = [
        ("emily.chen@linesight.io", "Emily Chen", now - timedelta(hours=2)),
        ("marcus.johnson@linesight.io", "Marcus Johnson", now - timedelta(days=1)),
    ]
    for email, name, last_login in detroit_fm_configs:
        user = await create_manager(email, name, last_login, gravatar_url(email))
        await db.flush()
        managers_created += 1
        # Factory Scope
        stmt = select(UserScope).where(UserScope.user_id == user.id, UserScope.scope_type == RoleScope.FACTORY)
        if not (await db.execute(stmt)).scalar_one_or_none():
            db.add(UserScope(
                user_id=user.id,
                scope_type=RoleScope.FACTORY,
                organization_id=demo_org.id,
                factory_id=factory_a.id,
                role=UserRole.FACTORY_MANAGER
            ))
            scopes_created += 1
    print(f"  Created 2 Factory Managers for Detroit")

    # 2. Line Managers (Specific Personas for first 5 Detroit lines)
    # Total needed: 5 lines * 2-3 managers ~= 12-13 managers
    line_manager_pool = [
        # Line 1: Chassis (3 mgrs including UI breaker)
        ("sofia.rodriguez@linesight.io", "Sofia Rodriguez", 0),
        ("james.williams@linesight.io", "James Williams", 0),
        ("christopher.montgomery@linesight.io", "Christopher-James Montgomery-Smythe III, PhD, MBA", 0), # UI Breaker
        
        # Line 2: Paint (2 mgrs including Ghost)
        ("aisha.patel@linesight.io", "Aisha Patel", 1),
        ("ghost.user@linesight.io", "Ghost User", 1), # Ghost

        # Line 3: Final Assembly (3 mgrs including Stale)
        ("michael.brown@linesight.io", "Michael Brown", 2),
        ("sarah.davis@linesight.io", "Sarah Davis", 2),
        ("stale.user@linesight.io", "Stale User", 2), # Stale

        # Line 4: Quality (2 mgrs including Suspended)
        ("david.wilson@linesight.io", "David Wilson", 3),
        ("suspended.user@linesight.io", "Suspended User", 3), # Suspended

        # Line 5: Packaging (2 mgrs)
        ("jessica.martinez@linesight.io", "Jessica Martinez", 4),
        ("daniel.anderson@linesight.io", "Daniel Anderson", 4),
    ]

    for email, name, line_idx in line_manager_pool:
        # Special case handling for edge users
        is_active = True
        last_login = now - timedelta(days=1)
        avatar = gravatar_url(email)

        if "ghost" in email:
            last_login = None
            avatar = None
        elif "stale" in email:
            last_login = now - timedelta(days=95)
        elif "suspended" in email:
            is_active = False
        
        user = await create_manager(email, name, last_login, avatar, is_active=is_active, role=UserRole.LINE_MANAGER)
        await db.flush()
        managers_created += 1

        # Line Scope
        if line_idx < len(detroit_lines):
            target_line = detroit_lines[line_idx]
            stmt = select(UserScope).where(
                UserScope.user_id == user.id, 
                UserScope.data_source_id == target_line.id
            )
            if not (await db.execute(stmt)).scalar_one_or_none():
                db.add(UserScope(
                    user_id=user.id,
                    scope_type=RoleScope.LINE,
                    organization_id=demo_org.id,
                    factory_id=factory_a.id,
                    data_source_id=target_line.id,
                    role=UserRole.LINE_MANAGER 
                ))
                scopes_created += 1
                line_manager_counts[target_line.id] += 1
    
    print(f"  Created Specific Line Managers for initial Detroit lines")

    # --- 3. Cross-Factory Manager ---
    cross_pollinated = await create_manager(
        "cross.factory@linesight.io",
        "Cross-Factory Manager",
        now - timedelta(days=2),
        gravatar_url("cross.factory@linesight.io"),
        role=UserRole.LINE_MANAGER,
    )
    await db.flush()
    managers_created += 1
    
    # Assign to Detroit Line 5 (Packaging, index 4) -> (if distinct, check bounds)
    if len(detroit_lines) > 4:
        db.add(UserScope(
            user_id=cross_pollinated.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_a.id,
            data_source_id=detroit_lines[4].id,
            role=UserRole.LINE_MANAGER,
        ))
        scopes_created += 1
        line_manager_counts[detroit_lines[4].id] += 1

    # Also assign to Shanghai Line 1
    if len(shanghai_lines) > 0:
        db.add(UserScope(
            user_id=cross_pollinated.id,
            scope_type=RoleScope.LINE,
            organization_id=demo_org.id,
            factory_id=factory_b.id,
            data_source_id=shanghai_lines[0].id,
            role=UserRole.LINE_MANAGER,
        ))
        scopes_created += 1
        line_manager_counts[shanghai_lines[0].id] += 1
        
    print("  Created Cross-Factory Manager")

    # Unassigned (Keep 2)
    unassigned_names = [
        ("unassigned.one@linesight.io", "Unassigned Manager One"),
        ("unassigned.two@linesight.io", "Unassigned Manager Two"),
    ]
    for email, name in unassigned_names:
        user = await create_manager(email, name, now - timedelta(days=10), gravatar_url(email))
        await db.flush()
        managers_created += 1
    print("  Created 2 Unassigned Managers")
    
    # --- 4. Fill Gaps: Ensure Every Line has 1-2 Managers ---
    print("  Filling gaps to ensure 1-2 managers per line...")
    import random
    
    for line in all_lines:
        current_count = line_manager_counts.get(line.id, 0)
        target_count = random.randint(1, 2) # Target 1 or 2 managers per line
        
        while current_count < target_count:
            # Create a Generic Line Manager
            # Use factory code + part of line id hash to make unique-ish email/name
            suffix = str(uuid.uuid4())[:8]
            email = f"manager.{suffix}@linesight.io"
            name = f"Line Manager {suffix}"
            
            user = await create_manager(email, name, now - timedelta(days=random.randint(1, 30)), gravatar_url(email), role=UserRole.LINE_MANAGER)
            await db.flush()
            managers_created += 1
            
            db.add(UserScope(
                user_id=user.id,
                scope_type=RoleScope.LINE,
                organization_id=demo_org.id,
                factory_id=line.factory_id,
                data_source_id=line.id,
                role=UserRole.LINE_MANAGER
            ))
            scopes_created += 1
            current_count += 1
            line_manager_counts[line.id] = current_count

    await db.flush()
    print(f"\nTotal: Created {managers_created} managers with {scopes_created} scope assignments")

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
                data_source_id=detroit_lines[i % len(detroit_lines)].id,
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
    # 7. PRODUCTION RUNS INTENTIONALLY SKIPPED
    # =========================================================================
    # NOTE: Production runs are NOT seeded to keep the database clean for testing.
    # Upload your own data via Excel imports to test real workflows.

    await db.commit()
    print("\n=== Database seeding completed successfully! ===")
    print(f"""
Summary:
  - 3 Factories (Detroit, Shanghai, Empty Shell)
  - {len(detroit_lines)} Detroit lines + {len(shanghai_lines)} Shanghai lines
  - {managers_created} diverse managers with {scopes_created} scope assignments
  - Edge cases: Ghost, Stale, Suspended, Super Manager, Unassigned, Cross-Factory
  - Overcrowded line: Chassis Assembly (5+ managers)
  - 2 UUID-named lines in Shanghai (for 'Untitled Line' UI testing)
  - Production runs: EMPTY (upload your own data for testing)
""")
