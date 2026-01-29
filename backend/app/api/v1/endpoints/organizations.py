"""
Organization endpoints for LineSight.
CRUD operations for organizations (multi-tenant root).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, get_db
from app.models import ProductionLine  # Alias for DataSource
from app.models.factory import Factory
from app.models.user import Organization
from app.schemas.user import OrganizationRead, OrganizationUpdate

router = APIRouter()


@router.get("/me", response_model=OrganizationRead)
async def get_my_organization(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get the current user's organization.

    Returns the organization that the authenticated user belongs to.
    """
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return organization


@router.patch("/me", response_model=OrganizationRead)
async def update_my_organization(
    org_data: OrganizationUpdate,
    current_user: AdminUser,  # Only admins can update organization
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update the current user's organization.

    Only admins can update organization details.
    Updatable fields: name, code, primary_email, primary_phone, subscription_tier
    """
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Update fields
    update_data = org_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(organization, field, value)

    await db.commit()
    await db.refresh(organization)
    return organization


@router.get("/quota-status")
async def get_quota_status(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get organization's quota status.

    Returns current usage and limits for factories and production lines.
    """
    # Get organization with quotas
    org_result = await db.execute(
        select(Organization).where(Organization.id == current_user.organization_id)
    )
    organization = org_result.scalar_one()

    # Count active factories
    factory_count_result = await db.execute(
        select(func.count(Factory.id)).where(
            Factory.organization_id == current_user.organization_id, Factory.is_active
        )
    )
    factory_count = factory_count_result.scalar()

    # Get factories with line counts
    factory_line_counts_result = await db.execute(
        select(
            Factory.id, Factory.name, func.count(ProductionLine.id).label("line_count")
        )
        .outerjoin(
            ProductionLine,
            (Factory.id == ProductionLine.factory_id) & (ProductionLine.is_active),
        )
        .where(
            Factory.organization_id == current_user.organization_id, Factory.is_active
        )
        .group_by(Factory.id, Factory.name)
    )
    factory_line_counts = factory_line_counts_result.all()

    return {
        "subscription_tier": organization.subscription_tier,
        "factories": {
            "current": factory_count,
            "max": organization.max_factories,
            "available": max(
                0, (organization.max_factories or 0) - (factory_count or 0)
            ),
            "can_create": (factory_count or 0) < (organization.max_factories or 0),
        },
        "lines_per_factory": {
            "max": organization.max_lines_per_factory,
            "by_factory": [
                {
                    "factory_id": str(f.id),
                    "factory_name": f.name,
                    "current": f.line_count or 0,
                    "available": max(
                        0, organization.max_lines_per_factory - (f.line_count or 0)
                    ),
                    "can_create": (f.line_count or 0)
                    < organization.max_lines_per_factory,
                }
                for f in factory_line_counts
            ],
        },
    }


@router.get("/{organization_id}", response_model=OrganizationRead)
async def get_organization(
    organization_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a specific organization by ID.

    Users can only view their own organization.
    """
    # Users can only view their own organization
    if organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization",
        )

    result = await db.execute(
        select(Organization).where(Organization.id == organization_id)
    )
    organization = result.scalar_one_or_none()

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    return organization
