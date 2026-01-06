"""add_ai_decisions_table

Revision ID: 911f26a1f331
Revises: 36e4cd58c84f
Create Date: 2025-12-25 08:39:33.660651+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "911f26a1f331"
down_revision: str | None = "36e4cd58c84f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create ai_decisions table
    op.create_table(
        "ai_decisions",
        sa.Column("id", sa.CHAR(36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("data_source_id", sa.CHAR(36), nullable=True),
        sa.Column(
            "agent_type",
            sa.Enum("schema_inference", "code_generation", name="agenttype"),
            nullable=False,
        ),
        sa.Column("model_used", sa.String(50), nullable=False),
        sa.Column("input_summary", sa.Text(), nullable=False),
        sa.Column("output_summary", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("reasoning", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(
            ["data_source_id"], ["data_sources.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes
    op.create_index(
        "ix_ai_decisions_data_source_id", "ai_decisions", ["data_source_id"]
    )
    op.create_index("ix_ai_decisions_agent_type", "ai_decisions", ["agent_type"])
    op.create_index("ix_ai_decisions_created_at", "ai_decisions", ["created_at"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_ai_decisions_created_at", table_name="ai_decisions")
    op.drop_index("ix_ai_decisions_agent_type", table_name="ai_decisions")
    op.drop_index("ix_ai_decisions_data_source_id", table_name="ai_decisions")

    # Drop table
    op.drop_table("ai_decisions")
