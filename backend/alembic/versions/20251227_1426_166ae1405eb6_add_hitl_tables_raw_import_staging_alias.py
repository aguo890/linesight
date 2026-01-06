"""add_hitl_tables_raw_import_staging_alias

Revision ID: 166ae1405eb6
Revises: 95bef0ce76fb
Create Date: 2025-12-27 14:26:54.855730+00:00

HITL Feature Migration:
- raw_imports: Immutable storage for uploaded files
- staging_records: Validation sandbox before production promotion
- alias_mappings: User-learned column aliases for matching
- schema_mappings: Enhanced with waterfall matching metadata
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "166ae1405eb6"
down_revision: str | None = "95bef0ce76fb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create alias_mappings table for learned column aliases
    op.create_table(
        "alias_mappings",
        sa.Column("scope", sa.String(length=50), nullable=False),
        sa.Column("organization_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("source_alias", sa.String(length=255), nullable=False),
        sa.Column("source_alias_normalized", sa.String(length=255), nullable=False),
        sa.Column("canonical_field", sa.String(length=100), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=False),
        sa.Column("created_by_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("correction_count", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scope",
            "organization_id",
            "factory_id",
            "source_alias_normalized",
            name="uq_alias_per_scope",
        ),
    )
    op.create_index(
        op.f("ix_alias_mappings_canonical_field"),
        "alias_mappings",
        ["canonical_field"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alias_mappings_factory_id"),
        "alias_mappings",
        ["factory_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alias_mappings_organization_id"),
        "alias_mappings",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alias_mappings_scope"), "alias_mappings", ["scope"], unique=False
    )
    op.create_index(
        op.f("ix_alias_mappings_source_alias"),
        "alias_mappings",
        ["source_alias"],
        unique=False,
    )
    op.create_index(
        op.f("ix_alias_mappings_source_alias_normalized"),
        "alias_mappings",
        ["source_alias_normalized"],
        unique=False,
    )

    # Create raw_imports table for immutable file storage
    op.create_table(
        "raw_imports",
        sa.Column("uploaded_by_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("file_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("encoding_detected", sa.String(length=50), nullable=True),
        sa.Column("sheet_count", sa.Integer(), nullable=False),
        sa.Column("sheet_names", sa.Text(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("column_count", sa.Integer(), nullable=True),
        sa.Column("header_row_detected", sa.Integer(), nullable=True),
        sa.Column("raw_headers", sa.Text(), nullable=True),
        sa.Column("sample_data", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_raw_imports_factory_id"), "raw_imports", ["factory_id"], unique=False
    )
    op.create_index(
        op.f("ix_raw_imports_uploaded_by_id"),
        "raw_imports",
        ["uploaded_by_id"],
        unique=False,
    )

    # Create staging_records table for validation sandbox
    op.create_table(
        "staging_records",
        sa.Column("raw_import_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("validation_errors", sa.Text(), nullable=True),
        sa.Column("validation_warnings", sa.Text(), nullable=True),
        sa.Column("record_data", sa.Text(), nullable=False),
        sa.Column("normalized_data", sa.Text(), nullable=True),
        sa.Column("quality_score", sa.Float(), nullable=True),
        sa.Column("null_field_count", sa.Integer(), nullable=True),
        sa.Column("promoted_at", sa.DateTime(), nullable=True),
        sa.Column("promoted_to_table", sa.String(length=100), nullable=True),
        sa.Column("promoted_record_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["raw_import_id"], ["raw_imports.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_staging_records_raw_import_id"),
        "staging_records",
        ["raw_import_id"],
        unique=False,
    )

    # Add waterfall matching metadata to schema_mappings
    op.add_column(
        "schema_mappings",
        sa.Column("matching_tier", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "schema_mappings", sa.Column("tier_confidence", sa.Float(), nullable=True)
    )
    op.add_column(
        "schema_mappings", sa.Column("tier_breakdown", sa.Text(), nullable=True)
    )
    op.add_column(
        "schema_mappings", sa.Column("fuzzy_scores", sa.Text(), nullable=True)
    )
    op.add_column(
        "schema_mappings",
        sa.Column("user_corrected", sa.Boolean(), nullable=True, server_default="0"),
    )
    op.add_column(
        "schema_mappings", sa.Column("correction_count", sa.Integer(), nullable=True)
    )
    op.add_column(
        "schema_mappings", sa.Column("correction_history", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    # Drop schema_mappings waterfall columns
    op.drop_column("schema_mappings", "correction_history")
    op.drop_column("schema_mappings", "correction_count")
    op.drop_column("schema_mappings", "user_corrected")
    op.drop_column("schema_mappings", "fuzzy_scores")
    op.drop_column("schema_mappings", "tier_breakdown")
    op.drop_column("schema_mappings", "tier_confidence")
    op.drop_column("schema_mappings", "matching_tier")

    # Drop staging_records table
    op.drop_index(
        op.f("ix_staging_records_raw_import_id"), table_name="staging_records"
    )
    op.drop_table("staging_records")

    # Drop raw_imports table
    op.drop_index(op.f("ix_raw_imports_uploaded_by_id"), table_name="raw_imports")
    op.drop_index(op.f("ix_raw_imports_factory_id"), table_name="raw_imports")
    op.drop_table("raw_imports")

    # Drop alias_mappings table
    op.drop_index(
        op.f("ix_alias_mappings_source_alias_normalized"), table_name="alias_mappings"
    )
    op.drop_index(op.f("ix_alias_mappings_source_alias"), table_name="alias_mappings")
    op.drop_index(op.f("ix_alias_mappings_scope"), table_name="alias_mappings")
    op.drop_index(
        op.f("ix_alias_mappings_organization_id"), table_name="alias_mappings"
    )
    op.drop_index(op.f("ix_alias_mappings_factory_id"), table_name="alias_mappings")
    op.drop_index(
        op.f("ix_alias_mappings_canonical_field"), table_name="alias_mappings"
    )
    op.drop_table("alias_mappings")
