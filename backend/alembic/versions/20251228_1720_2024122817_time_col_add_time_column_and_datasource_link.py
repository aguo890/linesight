"""add time_column and datasource_link

Revision ID: 2024122817_time_col
Revises: f6854713df1d
Create Date: 2025-12-28 17:20:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2024122817_time_col"
down_revision: str | None = "f6854713df1d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add time_column and time_format to data_sources
    op.add_column(
        "data_sources", sa.Column("time_column", sa.String(100), nullable=True)
    )
    op.add_column(
        "data_sources", sa.Column("time_format", sa.String(50), nullable=True)
    )

    # Set default value for existing rows before making NOT NULL
    op.execute("UPDATE data_sources SET time_column = 'date' WHERE time_column IS NULL")

    # Now make time_column NOT NULL
    op.alter_column(
        "data_sources", "time_column", existing_type=sa.String(100), nullable=False
    )

    # Add data_source_id and time_column_used to raw_imports
    op.add_column(
        "raw_imports", sa.Column("data_source_id", mysql.CHAR(36), nullable=True)
    )
    op.add_column(
        "raw_imports", sa.Column("time_column_used", sa.String(100), nullable=True)
    )

    # Create foreign key constraint
    op.create_foreign_key(
        "fk_rawimport_datasource",
        "raw_imports",
        "data_sources",
        ["data_source_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Create index for data_source_id
    op.create_index("ix_raw_imports_data_source_id", "raw_imports", ["data_source_id"])


def downgrade() -> None:
    # Remove index
    op.drop_index("ix_raw_imports_data_source_id", table_name="raw_imports")

    # Remove foreign key
    op.drop_constraint("fk_rawimport_datasource", "raw_imports", type_="foreignkey")

    # Remove columns from raw_imports
    op.drop_column("raw_imports", "time_column_used")
    op.drop_column("raw_imports", "data_source_id")

    # Remove columns from data_sources
    op.drop_column("data_sources", "time_format")
    op.drop_column("data_sources", "time_column")
