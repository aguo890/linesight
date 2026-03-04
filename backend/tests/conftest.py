# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Pytest configuration and fixtures for LineSight tests.
Refactored to enforce PostgreSQL parity and remove SQLite support.
"""

import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import MagicMock

import pandas as pd
import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.database import get_db
from app.main import app
from app.models.base import Base
import freezegun
from app.api.deps import get_current_user

# =============================================================================
# Database Configuration (PostgreSQL Only)
# =============================================================================

# Enforce PostgreSQL for testing
# Default to port 5434 (exposed by Docker) for local runs, or 5432 for CI/Docker internal runs
TEST_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5434/linesight_test",
)

# Derive sync URL for legacy sync tests
SYNC_TEST_DATABASE_URL = TEST_DATABASE_URL.replace("+asyncpg", "+psycopg2")


@pytest.fixture(scope="session")
def event_loop():
    """
    Create an instance of the default event loop for each test session.
    Must be session-scoped to match the session-scoped db_engine.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    """Session-scoped async database engine using NullPool to prevent connection leaks."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool, echo=False)
    yield engine
    # CRITICAL: Dispose of the engine to close connections and prevent hangs
    await engine.dispose()


@pytest.fixture(scope="session")
def sync_db_engine():
    """Session-scoped sync database engine using NullPool."""
    engine = create_engine(
        SYNC_TEST_DATABASE_URL,
        poolclass=NullPool,
    )
    yield engine
    engine.dispose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database(db_engine):
    """Session-scoped fixture to handle table creation with correct dependency order."""
    from app.models.base import Base

    try:
        async with db_engine.begin() as conn:
            # PostgreSQL specific: bypass FK checks for mass creation/drop
            await conn.execute(text("SET session_replication_role = 'replica';"))

            # Create tables using metadata to respect dependency graph
            await conn.run_sync(Base.metadata.create_all)

            await conn.execute(text("SET session_replication_role = 'origin';"))
    except Exception as e:
        print(f"\n[!!!] DB Connection Error during table creation: {e}\n")
        raise e

    yield


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh, isolated database session for each test that rolls back."""
    # 1. Create a connection from the engine
    connection = await db_engine.connect()

    # 2. Begin a transaction that will be rolled back after each test
    transaction = await connection.begin()

    # 3. Create the session bound to this specific connection
    # Critical: expire_on_commit=False prevents extra DB lookups after commit
    session = AsyncSession(bind=connection, expire_on_commit=False)

    try:
        yield session
    finally:
        # 4. CLEANUP PHASE: Ensure complete rollback and closure to prevent locks
        await session.rollback()
        await session.close()

        await transaction.rollback()
        await connection.close()


@pytest.fixture(scope="function")
def sync_db_session(sync_db_engine) -> Generator[Session, None, None]:
    """Synchronous database session for non-async tests."""
    # 1. Create a specific connection
    connection = sync_db_engine.connect()

    # 2. Begin a transaction
    transaction = connection.begin()

    # 3. Bind the session to the connection
    session = Session(bind=connection, expire_on_commit=False)

    try:
        yield session
    finally:
        # 4. Rollback and close everything to prevent locks
        session.close()
        transaction.rollback()
        connection.close()


# =============================================================================
# Client Fixtures
# =============================================================================


@pytest.fixture(scope="function")
def client(sync_db_session: Session) -> Generator[TestClient, None, None]:
    """Synchronous test client with mocked sync database."""
    from app.core.database import get_db

    def override_get_db():
        yield sync_db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Async test client with mocked database."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def fast_async_client(
    db_session: AsyncSession, test_organization
) -> AsyncGenerator[AsyncClient, None]:
    """Optimized async client with auth bypass for ~15% speed improvement."""
    from app.enums import UserRole

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    # Create a mock user object that mimics User model attributes
    mock_user = MagicMock()
    mock_user.id = "test-user-id"
    mock_user.email = "test@example.com"
    mock_user.role = UserRole.SYSTEM_ADMIN
    mock_user.organization_id = test_organization.id
    mock_user.is_active = True
    mock_user.is_verified = True

    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client_with_auth(client) -> Generator[TestClient, None, None]:
    """Test client with bypassed authentication."""
    from app.api.deps import get_current_user

    # Create fake user data
    fake_user = {
        "id": "test-user-id",
        "email": "test@example.com",
        "role": "system_admin",
        "organization_id": "test-org-id",
    }

    # Override dependency
    app.dependency_overrides[get_current_user] = lambda: fake_user

    yield client

    # Clean up
    app.dependency_overrides.pop(get_current_user, None)


# =============================================================================
# Model Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_organization(db_session: AsyncSession):
    """Create a test organization."""
    from app.models.user import Organization

    org = Organization(
        name="Test Factory Co",
        code="TEST001",
        primary_email="admin@testfactory.com",
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_organization):
    """Create a test user."""
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    user = User(
        organization_id=test_organization.id,
        email="test@example.com",
        hashed_password=hash_password("testpassword123"),
        full_name="Test User",
        role=UserRole.SYSTEM_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user) -> dict:
    """Generate auth headers for authenticated requests."""
    from app.core.security import create_access_token

    token = create_access_token(subject=test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def auth_headers_override(test_user) -> AsyncGenerator[dict, None]:
    """
    Auth headers with dependency override for speed.
    Use with fast_async_client for optimal performance.
    """
    from app.api.deps import get_current_user
    from app.core.security import create_access_token

    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    token = create_access_token(subject=test_user.id)

    headers = {"Authorization": f"Bearer {token}"}
    yield headers

    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def setup_test_files():
    """Ensure dummy files exist for tests to prevent FileNotFoundError."""
    base_dir = Path(__file__).parent / "data"
    base_dir.mkdir(parents=True, exist_ok=True)

    # 1. Dummy Excel (Comprehensive for demo/pipeline tests)
    excel_path = base_dir / "perfect_production.xlsx"
    df = pd.DataFrame(
        {
            "style_number": ["ST-001", "ST-002", "ST-003", "ST-004", "ST-005"],
            "po_number": ["PO-1001", "PO-1002", "PO-1003", "PO-1004", "PO-1005"],
            "buyer": ["Buyer A", "Buyer B", "Buyer C", "Buyer D", "Buyer E"],
            "production_date": [
                str(date.today() - timedelta(days=4)),
                str(date.today() - timedelta(days=3)),
                str(date.today() - timedelta(days=2)),
                str(date.today() - timedelta(days=1)),
                str(date.today()),
            ],
            "shift": ["day", "day", "night", "night", "day"],
            "actual_qty": [100, 150, 200, 120, 180],
            "planned_qty": [100, 150, 200, 120, 180],
            "operators_present": [20, 20, 25, 22, 24],
            "helpers_present": [5, 5, 5, 4, 6],
            "defects": [0, 1, 0, 2, 0],
            "dhu": [0.0, 0.67, 0.0, 1.67, 0.0],
            "downtime_minutes": [0, 10, 0, 0, 5],
            "downtime_reason": ["", "Breakdown", "", "", "Tea Break"],
            "sam": [2.5, 2.5, 2.5, 3.0, 3.0],
        }
    )
    df.to_excel(excel_path, index=False)

    # Also create copies as Standard_Master_Widget.xlsx and others for specific tests
    df.to_excel(base_dir / "Standard_Master_Widget.xlsx", index=False)
    df.to_excel(base_dir / "messy_production.xlsx", index=False)
    df.to_excel(base_dir / "ambiguous_production.xlsx", index=False)

    # 2. Dummy CSV
    csv_path = base_dir / "test_e2e.csv"
    df_csv = pd.DataFrame(
        {
            "Date": [str(date.today())],
            "Qty": [50],
            "Style": ["ST-001"],
            "PO": ["PO-1001"],
        }
    )
    df_csv.to_csv(csv_path, index=False)
    df_csv.to_csv(base_dir / "perfect_production.csv", index=False)


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch, mocker):
    """Set dummy API keys and mock LLM calls to prevent initialization and 401 errors."""
    monkeypatch.setenv("OPENAI_API_KEY", "dummy_key_for_tests")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "dummy_key_for_tests")
    monkeypatch.setenv("LLM_PROVIDER", "openai")

    # Mock OpenAI/DeepSeek completions globally
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[
        0
    ].message.content = '{"header_row": 0, "detected_headers": ["date", "style"], "column_mappings": {"date": "production_date"}, "confidence_scores": {"date": 0.9}, "recommendations": [], "suggested_widgets": []}'
    mock_response.usage.total_tokens = 100

    mocker.patch(
        "openai.resources.chat.completions.Completions.create",
        return_value=mock_response,
    )

    mocker.patch(
        "app.private_core.etl_agent.SemanticETLAgent._init_client",
        return_value=MagicMock(),
    )


@pytest.fixture
def frozen_time():
    """
    Freeze time for deterministic date-based tests.
    Usage: @pytest.mark.usefixtures("frozen_time")
    """
    with freezegun.freeze_time("2026-01-15 10:30:00", tz_offset=0):
        yield


# =============================================================================
# Shared Domain Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def test_factory(db_session: AsyncSession, test_organization):
    """Create a test factory."""
    from app.models.factory import Factory

    factory = Factory(
        organization_id=test_organization.id,
        name="Test Factory",
        code="TF001",
        country="US",
        timezone="UTC",
        locale="en-US",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)
    return factory


@pytest_asyncio.fixture
async def test_line(db_session: AsyncSession, test_factory):
    """Create a test data source (formerly production line)."""
    from app.models.datasource import DataSource

    data_source = DataSource(
        factory_id=test_factory.id,
        name="Test Line 1",
    )
    db_session.add(data_source)
    await db_session.commit()
    await db_session.refresh(data_source)
    return data_source


@pytest_asyncio.fixture
async def test_style(db_session: AsyncSession, test_factory):
    """Create a test style."""
    from app.models.production import Style

    style = Style(
        factory_id=test_factory.id,
        style_number="ST-FIXTURE-001",
        description="Fixture Style",
        buyer="Fixture Buyer",
        base_sam=10.0,
    )
    db_session.add(style)
    await db_session.commit()
    await db_session.refresh(style)
    return style


@pytest_asyncio.fixture
async def test_order(db_session: AsyncSession, test_style):
    """Create a test order."""
    from app.models.production import Order, OrderStatus

    order = Order(
        style_id=test_style.id,
        po_number="PO-FIXTURE-001",
        quantity=1000,
        status=OrderStatus.PENDING,
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)
    return order


@pytest.fixture
def sample_production_run_data():
    """Standard production run data with all required fields."""
    from datetime import date

    return {
        "production_date": str(date.today()),
        "shift": "day",
        "sam": 2.5,
        "operators_present": 25,
        "helpers_present": 5,
        "worked_minutes": 12000,
        "actual_qty": 0,
        "planned_qty": 0,
    }


# =============================================================================
# Dry-Run and Data Import Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def setup_dry_run_test_data(db_session: AsyncSession, test_organization):
    """Create comprehensive test data for dry-run testing."""
    from app.models.datasource import DataSource, SchemaMapping
    from app.models.factory import Factory

    factory = Factory(
        name="Dry Run Test Factory",
        organization_id=test_organization.id,
        code="DRT1",
        country="US",
        locale="en-US",
    )
    db_session.add(factory)
    await db_session.commit()
    await db_session.refresh(factory)

    ds = DataSource(
        name="Test Line A",
        factory_id=factory.id,
        source_name="Test Production Data",
        time_column="Date",
        description="Test data source with messy dates",
    )
    db_session.add(ds)
    await db_session.commit()
    await db_session.refresh(ds)

    line = ds

    column_map = {
        "Date": "production_date",
        "Style": "style_number",
        "PO": "po_number",
        "Produced": "actual_qty",
        "Target": "planned_qty",
        "Eff%": "line_efficiency",
        "SAM": "sam",
    }

    schema_mapping = SchemaMapping(
        data_source_id=ds.id,
        version=1,
        is_active=True,
        column_map=column_map,
        reviewed_by_user=True,
        user_corrected=False,
        correction_count=0,
    )
    db_session.add(schema_mapping)
    await db_session.commit()
    await db_session.refresh(ds)
    await db_session.refresh(schema_mapping)

    return factory, line, ds, schema_mapping


@pytest_asyncio.fixture
async def create_raw_import_with_messy_dates(
    db_session: AsyncSession, setup_dry_run_test_data, tmp_path
):
    """Create a RawImport with messy date formatting."""
    import json
    from app.models.raw_import import RawImport

    factory, line, ds, _ = setup_dry_run_test_data

    test_csv_content = """Date,Style,PO,Produced,Target,Eff%,SAM
12-19,ST100,PO123,85,100,85%,2.5
12-20,ST101,PO124,95,100,95%,3.0
1-5,ST102,PO125,75,100,75%,2.8
01-06,ST103,PO126,110,100,110%,2.2
2025-01-07,ST104,PO127,90,100,90,2.6"""

    test_file_path = tmp_path / "messy_dates.csv"
    test_file_path.write_text(test_csv_content)

    raw_import = RawImport(
        factory_id=factory.id,
        production_line_id=line.id,
        data_source_id=ds.id,
        original_filename="messy_dates.csv",
        file_path=str(test_file_path),
        file_size_bytes=len(test_csv_content),
        file_hash="abc123test",
        mime_type="text/csv",
        encoding_detected="utf-8",
        row_count=5,
        column_count=7,
        raw_headers=json.dumps(
            ["Date", "Style", "PO", "Produced", "Target", "Eff%", "SAM"]
        ),
        sample_data=json.dumps(
            [
                ["12-19", "ST100", "PO123", 85, 100, "85%", 2.5],
                ["12-20", "ST101", "PO124", 95, 100, "95%", 3.0],
            ]
        ),
        status="confirmed",
    )

    db_session.add(raw_import)
    await db_session.commit()
    await db_session.refresh(raw_import)

    return raw_import
