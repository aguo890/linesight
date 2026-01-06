"""add_dashboards_table

Revision ID: 95bef0ce76fb
Revises: 911f26a1f331
Create Date: 2025-12-25 09:31:26.930971+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "95bef0ce76fb"
down_revision: str | None = "911f26a1f331"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create dashboards table for user-created custom dashboards."""
    op.create_table(
        "dashboards",
        sa.Column("id", sa.CHAR(36), nullable=False),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("data_source_id", sa.CHAR(36), nullable=True),
        sa.Column("widget_config", sa.Text(), nullable=True),
        sa.Column("layout_config", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["data_source_id"], ["excel_uploads.id"], ondelete="SET NULL"
        ),
    )

    # Create indexes for better query performance
    op.create_index("ix_dashboards_user_id", "dashboards", ["user_id"])
    op.create_index("ix_dashboards_data_source_id", "dashboards", ["data_source_id"])


def downgrade() -> None:
    """Drop dashboards table."""
    op.drop_index("ix_dashboards_data_source_id", "dashboards")
    op.drop_index("ix_dashboards_user_id", "dashboards")
    op.drop_table("dashboards")
