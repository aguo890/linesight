"""add_organization_quotas

Revision ID: a1b2c3d4e5f6
Revises: 8e45e44027df
Create Date: 2025-12-28 04:49:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "8e45e44027df"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add quota columns to organizations table
    op.add_column(
        "organizations",
        sa.Column("max_factories", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "organizations",
        sa.Column(
            "max_lines_per_factory", sa.Integer(), nullable=False, server_default="1"
        ),
    )

    # Update existing organizations based on their subscription tier
    # STARTER: 1 factory, 1 line (default)
    # PRO: 1 factory, 10 lines
    # ENTERPRISE: 5 factories, 50 lines
    op.execute("""
        UPDATE organizations
        SET max_factories = CASE subscription_tier
            WHEN 'starter' THEN 1
            WHEN 'pro' THEN 1
            WHEN 'enterprise' THEN 5
            ELSE 1
        END,
        max_lines_per_factory = CASE subscription_tier
            WHEN 'starter' THEN 1
            WHEN 'pro' THEN 10
            WHEN 'enterprise' THEN 50
            ELSE 1
        END
    """)


def downgrade() -> None:
    op.drop_column("organizations", "max_lines_per_factory")
    op.drop_column("organizations", "max_factories")
