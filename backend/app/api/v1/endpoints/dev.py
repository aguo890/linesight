# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Development-only utilities and seeding endpoints.
"""

import shutil
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.db.seed import seed_data
from app.models import ProductionLine  # Alias for DataSource
from app.models.datasource import DataSource
from app.models.factory import Factory
from app.models.raw_import import RawImport
from app.models.user import Organization, SubscriptionTier, User, UserScope

router = APIRouter()


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def trigger_seed(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Seed the database with development data.
    Only available in non-production environments.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is not allowed in production.",
        )

    try:
        await seed_data(db)
        return {"status": "success", "message": "Database seeded successfully."}
    except Exception as e:
        import traceback

        tb = traceback.format_exc()
        # Still print to console for server logs
        print(tb)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(e)}\nTraceback:\n{tb}",
        ) from e


@router.delete("/reset-state", status_code=status.HTTP_200_OK)
async def reset_state(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Nuclear option: Reset system state.
    Deletes all Factories, Production Lines, Data Sources, and Uploaded Files.
    Keeps Users.
    Only available in non-production environments.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resetting state is not allowed in production.",
        )

    try:
        # 1. Delete Database Records
        # Cascading deletes should handle children (e.g. StagingRecords, SchemaMappings)
        # However, explicit deletes are safer if cascades aren't perfect

        # Delete Imports (and Staging)
        await db.execute(delete(RawImport))

        # Delete User Scopes (member assignments to data sources/factories)
        await db.execute(delete(UserScope))

        # Delete Data Sources (and mappings)
        await db.execute(delete(DataSource))

        # Delete Production Lines
        await db.execute(delete(ProductionLine))

        # Delete Factories
        await db.execute(delete(Factory))

        await db.commit()

        # 2. Delete Physical Files
        upload_dir = Path(settings.UPLOAD_DIR)
        if upload_dir.exists():
            # Delete contents but keep the root upload folder
            for item in upload_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

        return {
            "status": "success",
            "message": "System state reset. Factories, Lines, Data Sources, Members, and Files deleted.",
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reset failed: {str(e)}",
        ) from e


@router.delete("/cleanup", status_code=status.HTTP_200_OK)
async def cleanup_test_data(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Clean up development clutter without nuking everything.
    - Deletes test dashboards (names like 'asd', 'sdf', etc.)
    - Deduplicates alias_mappings
    Only available in non-production environments.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cleanup is not allowed in production.",
        )

    try:
        from sqlalchemy import text

        from app.models.dashboard import Dashboard

        # 1. Delete test dashboards with garbage names
        test_patterns = ["asd%", "sdf%", "dfg%", "fgh%", "qwe%", "zxc%"]
        deleted_dashboards = 0

        for pattern in test_patterns:
            result = await db.execute(
                delete(Dashboard).where(Dashboard.name.like(pattern))
            )
            deleted_dashboards += result.rowcount

        # Also delete single-char dashboards
        result = await db.execute(
            delete(Dashboard).where(Dashboard.name.op("REGEXP")("^[a-z]{1,3}$"))
        )
        deleted_dashboards += result.rowcount

        # 2. Deduplicate alias_mappings (keep most recent per canonical_field + source_alias_normalized)
        # First, find duplicates
        dedup_sql = text("""
            DELETE a1 FROM alias_mappings a1
            INNER JOIN alias_mappings a2
            ON a1.source_alias_normalized = a2.source_alias_normalized
               AND a1.canonical_field = a2.canonical_field
               AND a1.scope = a2.scope
               AND a1.created_at < a2.created_at
        """)
        dedup_result = await db.execute(dedup_sql)
        deleted_aliases = dedup_result.rowcount

        await db.commit()

        return {
            "status": "success",
            "message": "Cleanup complete",
            "deleted": {
                "dashboards": deleted_dashboards,
                "duplicate_aliases": deleted_aliases,
            },
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}",
        ) from e


class LimitUpdate(BaseModel):
    email: str = "demo@linesight.io"
    max_factories: int
    max_lines_per_factory: int
    subscription_tier: SubscriptionTier = SubscriptionTier.STARTER


@router.put("/update-limits", status_code=status.HTTP_200_OK)
async def update_limits(
    limits: LimitUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update organization limits for a specific user (email).
    Useful for testing quota enforcement.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Updating limits is not allowed in production.",
        )

    # 1. Find User
    result = await db.execute(select(User).where(User.email == limits.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {limits.email} not found",
        )

    # 2. Find Organization
    org_result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = org_result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found for user",
        )

    # 3. Update Limits
    org.max_factories = limits.max_factories
    org.max_lines_per_factory = limits.max_lines_per_factory
    org.subscription_tier = limits.subscription_tier

    await db.commit()
    await db.refresh(org)

    return {
        "status": "success",
        "message": f"Updated limits for {limits.email} (Org: {org.name})",
        "data": {
            "max_factories": org.max_factories,
            "max_lines_per_factory": org.max_lines_per_factory,
            "subscription_tier": org.subscription_tier,
        },
    }


@router.post("/aggregate-dhu", status_code=status.HTTP_200_OK)
async def trigger_dhu_aggregation(
    db: Annotated[AsyncSession, Depends(get_db)],
    days_back: int = 7,
    factory_id: str | None = None,
):
    """
    Manually trigger DHU report aggregation.

    Computes DHUReport entries from QualityInspection data.
    Useful for testing and backfilling.

    Args:
        days_back: Number of days to process (default 7)
        factory_id: Optional filter for specific factory
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manual aggregation trigger is not allowed in production.",
        )

    from app.services.dhu_aggregation import run_dhu_aggregation

    try:
        result = await run_dhu_aggregation(
            db, days_back=days_back, factory_id=factory_id
        )
        return {
            "status": "success",
            "message": "DHU aggregation completed",
            "data": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Aggregation failed: {str(e)}",
        ) from e
