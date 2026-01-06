"""Initial migration

Revision ID: b196a06045bf
Revises:
Create Date: 2025-12-25 05:39:52.908401+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b196a06045bf"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        "organizations",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column(
            "subscription_tier",
            sa.Enum("STARTER", "PRO", "ENTERPRISE", name="subscriptiontier"),
            nullable=False,
        ),
        sa.Column("settings", sa.Text(), nullable=True),
        sa.Column("primary_email", sa.String(length=255), nullable=True),
        sa.Column("primary_phone", sa.String(length=50), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # 2. Factories
    op.create_table(
        "factories",
        sa.Column("organization_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column("total_lines", sa.Integer(), nullable=True),
        sa.Column("total_workers", sa.Integer(), nullable=True),
        sa.Column("daily_capacity_units", sa.Integer(), nullable=True),
        sa.Column("certifications", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index(
        op.f("ix_factories_organization_id"),
        "factories",
        ["organization_id"],
        unique=False,
    )

    # 3. Production Lines (Note: supervisor_id FK will be added later)
    op.create_table(
        "production_lines",
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("target_operators", sa.Integer(), nullable=True),
        sa.Column("target_efficiency_pct", sa.Integer(), nullable=True),
        sa.Column("specialty", sa.String(length=100), nullable=True),
        sa.Column("supervisor_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_production_lines_factory_id"),
        "production_lines",
        ["factory_id"],
        unique=False,
    )

    # 4. Workers
    op.create_table(
        "workers",
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("employee_id", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("primary_skill", sa.String(length=100), nullable=True),
        sa.Column("line_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("hire_date", sa.Date(), nullable=True),
        sa.Column("termination_date", sa.Date(), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["line_id"], ["production_lines.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("factory_id", "employee_id", name="uq_factory_employee"),
    )
    op.create_index(
        op.f("ix_workers_employee_id"), "workers", ["employee_id"], unique=False
    )
    op.create_index(
        op.f("ix_workers_factory_id"), "workers", ["factory_id"], unique=False
    )

    # 5. Connect Supervisor FK (Circular dependency resolved)
    op.create_foreign_key(
        "fk_production_lines_supervisor",
        "production_lines",
        "workers",
        ["supervisor_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 6. Users
    op.create_table(
        "users",
        sa.Column("organization_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "role",
            sa.Enum("ADMIN", "MANAGER", "ANALYST", "VIEWER", name="userrole"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(
        op.f("ix_users_organization_id"), "users", ["organization_id"], unique=False
    )

    # 7. Rest of the tables (Order doesn't matter as much now, but keeping clean)
    op.create_table(
        "worker_attendances",
        sa.Column("worker_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("clock_in", sa.Time(), nullable=True),
        sa.Column("clock_out", sa.Time(), nullable=True),
        sa.Column("hours_regular", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("hours_overtime", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("hours_total", sa.Numeric(precision=4, scale=2), nullable=True),
        sa.Column("is_present", sa.Boolean(), nullable=False),
        sa.Column("absence_reason", sa.String(length=100), nullable=True),
        sa.Column("is_approved", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("worker_id", "work_date", name="uq_worker_date"),
    )
    op.create_index(
        op.f("ix_worker_attendances_work_date"),
        "worker_attendances",
        ["work_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_worker_attendances_worker_id"),
        "worker_attendances",
        ["worker_id"],
        unique=False,
    )
    op.create_table(
        "worker_skills",
        sa.Column("worker_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("operation", sa.String(length=100), nullable=False),
        sa.Column("operation_category", sa.String(length=100), nullable=True),
        sa.Column("proficiency_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("sam_achieved", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("efficiency_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("defect_rate_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("pieces_lifetime", sa.Integer(), nullable=True),
        sa.Column("pieces_30d", sa.Integer(), nullable=True),
        sa.Column("is_certified", sa.Boolean(), nullable=False),
        sa.Column("certification_date", sa.Date(), nullable=True),
        sa.Column("last_assessed", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("worker_id", "operation", name="uq_worker_operation"),
    )
    op.create_index(
        op.f("ix_worker_skills_operation"), "worker_skills", ["operation"], unique=False
    )
    op.create_index(
        op.f("ix_worker_skills_worker_id"), "worker_skills", ["worker_id"], unique=False
    )
    op.create_table(
        "dhu_reports",
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column(
            "period_type",
            sa.Enum("DAILY", "WEEKLY", "MONTHLY", name="periodtype"),
            nullable=False,
        ),
        sa.Column("avg_dhu", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("min_dhu", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("max_dhu", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("total_inspected", sa.Integer(), nullable=True),
        sa.Column("total_defects", sa.Integer(), nullable=True),
        sa.Column("total_rejected", sa.Integer(), nullable=True),
        sa.Column("top_defects", sa.Text(), nullable=True),
        sa.Column("top_operations", sa.Text(), nullable=True),
        sa.Column("top_lines", sa.Text(), nullable=True),
        sa.Column("dhu_change_pct", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("trend_direction", sa.String(length=20), nullable=True),
        sa.Column("recommendations", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "factory_id", "report_date", "period_type", name="uq_factory_date_period"
        ),
    )
    op.create_index(
        op.f("ix_dhu_reports_factory_id"), "dhu_reports", ["factory_id"], unique=False
    )
    op.create_index(
        op.f("ix_dhu_reports_report_date"), "dhu_reports", ["report_date"], unique=False
    )
    op.create_table(
        "excel_uploads",
        sa.Column("user_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column(
            "file_type",
            sa.Enum(
                "CRITICAL_PATH",
                "CUTTING_TICKET",
                "PACKING_LIST",
                "PRODUCTION_LOG",
                "QUALITY_REPORT",
                "FABRIC_INVENTORY",
                "WORKER_ROSTER",
                "OTHER",
                name="filetype",
            ),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("storage_path", sa.String(length=1000), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("sheet_count", sa.Integer(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("column_count", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "VALIDATING",
                "PROCESSING",
                "COMPLETED",
                "FAILED",
                name="uploadstatus",
            ),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_excel_uploads_factory_id"),
        "excel_uploads",
        ["factory_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_excel_uploads_user_id"), "excel_uploads", ["user_id"], unique=False
    )
    op.create_table(
        "fabric_lots",
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("lot_number", sa.String(length=100), nullable=False),
        sa.Column("fabric_type", sa.String(length=100), nullable=True),
        sa.Column("composition", sa.String(length=255), nullable=True),
        sa.Column("width_cm", sa.Integer(), nullable=True),
        sa.Column("gsm", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(length=100), nullable=True),
        sa.Column("supplier", sa.String(length=255), nullable=True),
        sa.Column("origin_country", sa.String(length=100), nullable=True),
        sa.Column("mill_name", sa.String(length=255), nullable=True),
        sa.Column("received_date", sa.Date(), nullable=True),
        sa.Column("initial_meters", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("available_meters", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("reserved_meters", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("unit_cost", sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("certifications", sa.Text(), nullable=True),
        sa.Column("inspection_status", sa.String(length=50), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("factory_id", "lot_number", name="uq_factory_lot"),
    )
    op.create_index(
        op.f("ix_fabric_lots_factory_id"), "fabric_lots", ["factory_id"], unique=False
    )
    op.create_index(
        op.f("ix_fabric_lots_lot_number"), "fabric_lots", ["lot_number"], unique=False
    )
    op.create_index(
        op.f("ix_fabric_lots_origin_country"),
        "fabric_lots",
        ["origin_country"],
        unique=False,
    )
    op.create_index(
        op.f("ix_fabric_lots_supplier"), "fabric_lots", ["supplier"], unique=False
    )
    op.create_table(
        "styles",
        sa.Column("factory_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("style_number", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("buyer", sa.String(length=255), nullable=True),
        sa.Column("season", sa.String(length=50), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("base_sam", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column(
            "complexity_rating",
            sa.Enum("LOW", "MEDIUM", "HIGH", name="complexityrating"),
            nullable=True,
        ),
        sa.Column("bom_summary", sa.Text(), nullable=True),
        sa.Column("tech_pack_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["factory_id"], ["factories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("factory_id", "style_number", name="uq_factory_style"),
    )
    op.create_index(op.f("ix_styles_buyer"), "styles", ["buyer"], unique=False)
    op.create_index(
        op.f("ix_styles_factory_id"), "styles", ["factory_id"], unique=False
    )
    op.create_index(
        op.f("ix_styles_style_number"), "styles", ["style_number"], unique=False
    )
    op.create_table(
        "orders",
        sa.Column("style_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("po_number", sa.String(length=100), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("size_breakdown", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=100), nullable=True),
        sa.Column("order_date", sa.Date(), nullable=True),
        sa.Column("ex_factory_date", sa.Date(), nullable=True),
        sa.Column("actual_ship_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "CONFIRMED",
                "CUTTING",
                "SEWING",
                "FINISHING",
                "PACKING",
                "SHIPPED",
                "CANCELLED",
                name="orderstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.Enum("NORMAL", "RUSH", "CRITICAL", name="orderpriority"),
            nullable=False,
        ),
        sa.Column("qty_cut", sa.Integer(), nullable=False),
        sa.Column("qty_sewn", sa.Integer(), nullable=False),
        sa.Column("qty_packed", sa.Integer(), nullable=False),
        sa.Column("qty_shipped", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["style_id"], ["styles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("style_id", "po_number", name="uq_style_po"),
    )
    op.create_index(op.f("ix_orders_po_number"), "orders", ["po_number"], unique=False)
    op.create_index(op.f("ix_orders_status"), "orders", ["status"], unique=False)
    op.create_index(op.f("ix_orders_style_id"), "orders", ["style_id"], unique=False)
    op.create_table(
        "parsed_datasets",
        sa.Column("upload_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("target_table", sa.String(length=100), nullable=False),
        sa.Column("schema_version", sa.String(length=50), nullable=True),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("completeness_pct", sa.String(length=10), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["upload_id"], ["excel_uploads.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_parsed_datasets_upload_id"),
        "parsed_datasets",
        ["upload_id"],
        unique=False,
    )
    op.create_table(
        "processing_jobs",
        sa.Column("upload_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("llm_model", sa.String(length=100), nullable=True),
        sa.Column("llm_temperature", sa.String(length=10), nullable=True),
        sa.Column("sample_rows_sent", sa.Integer(), nullable=True),
        sa.Column("schema_inference", sa.Text(), nullable=True),
        sa.Column("inferred_headers", sa.Text(), nullable=True),
        sa.Column("generated_code", sa.Text(), nullable=True),
        sa.Column("code_version", sa.Integer(), nullable=False),
        sa.Column("execution_log", sa.Text(), nullable=True),
        sa.Column("rows_processed", sa.Integer(), nullable=True),
        sa.Column("rows_failed", sa.Integer(), nullable=True),
        sa.Column("tokens_input", sa.Integer(), nullable=True),
        sa.Column("tokens_output", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "QUEUED",
                "INFERRING",
                "GENERATING",
                "EXECUTING",
                "REVIEWING",
                "COMPLETED",
                "FAILED",
                name="jobstatus",
            ),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["upload_id"], ["excel_uploads.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_processing_jobs_upload_id"),
        "processing_jobs",
        ["upload_id"],
        unique=False,
    )
    op.create_table(
        "cut_tickets",
        sa.Column("fabric_lot_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("order_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("ticket_number", sa.String(length=100), nullable=False),
        sa.Column("cut_date", sa.Date(), nullable=True),
        sa.Column("plies", sa.Integer(), nullable=True),
        sa.Column("marker_length_cm", sa.Integer(), nullable=True),
        sa.Column(
            "consumption_meters", sa.Numeric(precision=10, scale=2), nullable=True
        ),
        sa.Column("wastage_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("size_ratio", sa.Text(), nullable=True),
        sa.Column("bundle_count", sa.Integer(), nullable=True),
        sa.Column("total_pieces", sa.Integer(), nullable=True),
        sa.Column("cutter_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cutter_id"], ["workers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["fabric_lot_id"], ["fabric_lots.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cut_tickets_fabric_lot_id"),
        "cut_tickets",
        ["fabric_lot_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_cut_tickets_order_id"), "cut_tickets", ["order_id"], unique=False
    )
    op.create_index(
        op.f("ix_cut_tickets_ticket_number"),
        "cut_tickets",
        ["ticket_number"],
        unique=False,
    )
    op.create_table(
        "packing_lists",
        sa.Column("order_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("packing_list_number", sa.String(length=100), nullable=False),
        sa.Column("ship_date", sa.Date(), nullable=True),
        sa.Column("destination", sa.String(length=255), nullable=True),
        sa.Column("ship_to_address", sa.Text(), nullable=True),
        sa.Column("carrier", sa.String(length=100), nullable=True),
        sa.Column("tracking_number", sa.String(length=255), nullable=True),
        sa.Column("container_number", sa.String(length=100), nullable=True),
        sa.Column("total_cartons", sa.Integer(), nullable=True),
        sa.Column("total_units", sa.Integer(), nullable=True),
        sa.Column(
            "total_net_weight_kg", sa.Numeric(precision=10, scale=2), nullable=True
        ),
        sa.Column(
            "total_gross_weight_kg", sa.Numeric(precision=10, scale=2), nullable=True
        ),
        sa.Column("total_cbm", sa.Numeric(precision=8, scale=3), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "PACKING",
                "READY",
                "SHIPPED",
                "IN_TRANSIT",
                "DELIVERED",
                name="shipmentstatus",
            ),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_packing_lists_order_id"), "packing_lists", ["order_id"], unique=False
    )
    op.create_index(
        op.f("ix_packing_lists_packing_list_number"),
        "packing_lists",
        ["packing_list_number"],
        unique=False,
    )
    op.create_table(
        "cartons",
        sa.Column("packing_list_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("carton_number", sa.String(length=50), nullable=False),
        sa.Column("size_breakdown", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=100), nullable=True),
        sa.Column("total_units", sa.Integer(), nullable=True),
        sa.Column("net_weight_kg", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("dimensions_cm", sa.Text(), nullable=True),
        sa.Column("length_cm", sa.Integer(), nullable=True),
        sa.Column("width_cm", sa.Integer(), nullable=True),
        sa.Column("height_cm", sa.Integer(), nullable=True),
        sa.Column("barcode", sa.String(length=100), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["packing_list_id"], ["packing_lists.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_cartons_packing_list_id"), "cartons", ["packing_list_id"], unique=False
    )
    op.create_table(
        "production_runs",
        sa.Column("order_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("line_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("cut_ticket_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("production_date", sa.Date(), nullable=False),
        sa.Column(
            "shift",
            sa.Enum("DAY", "NIGHT", "OVERTIME", name="shifttype"),
            nullable=False,
        ),
        sa.Column("planned_qty", sa.Integer(), nullable=True),
        sa.Column("actual_qty", sa.Integer(), nullable=False),
        sa.Column("wip_start", sa.Integer(), nullable=True),
        sa.Column("wip_end", sa.Integer(), nullable=True),
        sa.Column("earned_minutes", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("worked_minutes", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("operators_present", sa.Integer(), nullable=True),
        sa.Column("helpers_present", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["cut_ticket_id"], ["cut_tickets.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["line_id"], ["production_lines.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_production_runs_line_id"), "production_runs", ["line_id"], unique=False
    )
    op.create_index(
        op.f("ix_production_runs_order_id"),
        "production_runs",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_production_runs_production_date"),
        "production_runs",
        ["production_date"],
        unique=False,
    )
    op.create_table(
        "efficiency_metrics",
        sa.Column("production_run_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("efficiency_pct", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("sam_target", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("sam_actual", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("sam_variance", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("sam_variance_pct", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column(
            "capacity_utilization_pct", sa.Numeric(precision=6, scale=2), nullable=True
        ),
        sa.Column(
            "performance_tier",
            sa.Enum(
                "BELOW_TARGET", "ON_TARGET", "ABOVE_TARGET", name="performancetier"
            ),
            nullable=True,
        ),
        sa.Column(
            "factory_avg_efficiency", sa.Numeric(precision=6, scale=2), nullable=True
        ),
        sa.Column(
            "line_avg_efficiency", sa.Numeric(precision=6, scale=2), nullable=True
        ),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["production_run_id"], ["production_runs.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_efficiency_metrics_production_run_id"),
        "efficiency_metrics",
        ["production_run_id"],
        unique=True,
    )
    op.create_table(
        "production_outputs",
        sa.Column("worker_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("production_run_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("operation", sa.String(length=100), nullable=False),
        sa.Column("pieces_completed", sa.Integer(), nullable=False),
        sa.Column("sam_earned", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("minutes_worked", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("efficiency_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["production_run_id"], ["production_runs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_production_outputs_production_run_id"),
        "production_outputs",
        ["production_run_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_production_outputs_worker_id"),
        "production_outputs",
        ["worker_id"],
        unique=False,
    )
    op.create_table(
        "quality_inspections",
        sa.Column("production_run_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("inspector_id", mysql.CHAR(length=36), nullable=True),
        sa.Column(
            "inspection_type",
            sa.Enum("INLINE", "ENDLINE", "FINAL", "AQL", name="inspectiontype"),
            nullable=False,
        ),
        sa.Column("units_checked", sa.Integer(), nullable=False),
        sa.Column("defects_found", sa.Integer(), nullable=False),
        sa.Column("units_rejected", sa.Integer(), nullable=False),
        sa.Column("units_reworked", sa.Integer(), nullable=False),
        sa.Column("dhu", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("defect_rate_pct", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("aql_level", sa.String(length=20), nullable=True),
        sa.Column(
            "aql_result",
            sa.Enum("PASS", "FAIL", "PENDING", name="aqlresult"),
            nullable=True,
        ),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["inspector_id"], ["workers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["production_run_id"], ["production_runs.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_quality_inspections_production_run_id"),
        "quality_inspections",
        ["production_run_id"],
        unique=False,
    )
    op.create_table(
        "traceability_records",
        sa.Column("carton_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("fabric_lot_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("cut_ticket_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("production_run_id", mysql.CHAR(length=36), nullable=True),
        sa.Column(
            "compliance_standard",
            sa.Enum(
                "UFLPA",
                "EU_DPP",
                "CA_SB657",
                "UK_MSA",
                "OTHER",
                name="compliancestandard",
            ),
            nullable=False,
        ),
        sa.Column("chain_of_custody", sa.Text(), nullable=True),
        sa.Column("supporting_documents", sa.Text(), nullable=True),
        sa.Column(
            "verification_status",
            sa.Enum(
                "PENDING", "VERIFIED", "FLAGGED", "REJECTED", name="verificationstatus"
            ),
            nullable=False,
        ),
        sa.Column("verified_by_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("risk_score", sa.String(length=20), nullable=True),
        sa.Column("risk_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["carton_id"], ["cartons.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["cut_ticket_id"], ["cut_tickets.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["fabric_lot_id"], ["fabric_lots.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["production_run_id"], ["production_runs.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["verified_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_traceability_records_carton_id"),
        "traceability_records",
        ["carton_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_traceability_records_cut_ticket_id"),
        "traceability_records",
        ["cut_ticket_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_traceability_records_fabric_lot_id"),
        "traceability_records",
        ["fabric_lot_id"],
        unique=False,
    )
    op.create_table(
        "defects",
        sa.Column("inspection_id", mysql.CHAR(length=36), nullable=False),
        sa.Column("worker_id", mysql.CHAR(length=36), nullable=True),
        sa.Column("defect_type", sa.String(length=100), nullable=False),
        sa.Column("defect_code", sa.String(length=20), nullable=True),
        sa.Column("defect_category", sa.String(length=100), nullable=True),
        sa.Column("operation", sa.String(length=100), nullable=True),
        sa.Column(
            "severity",
            sa.Enum("MINOR", "MAJOR", "CRITICAL", name="defectseverity"),
            nullable=False,
        ),
        sa.Column("is_reworkable", sa.Boolean(), nullable=False),
        sa.Column("is_reworked", sa.Boolean(), nullable=False),
        sa.Column("root_cause", sa.String(length=255), nullable=True),
        sa.Column("machine_id", sa.String(length=50), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("id", mysql.CHAR(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["inspection_id"], ["quality_inspections.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["worker_id"], ["workers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_defects_defect_type"), "defects", ["defect_type"], unique=False
    )
    op.create_index(
        op.f("ix_defects_inspection_id"), "defects", ["inspection_id"], unique=False
    )
    op.create_index(
        op.f("ix_defects_worker_id"), "defects", ["worker_id"], unique=False
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f("ix_defects_worker_id"), table_name="defects")
    op.drop_index(op.f("ix_defects_inspection_id"), table_name="defects")
    op.drop_index(op.f("ix_defects_defect_type"), table_name="defects")
    op.drop_table("defects")
    op.drop_index(
        op.f("ix_traceability_records_fabric_lot_id"), table_name="traceability_records"
    )
    op.drop_index(
        op.f("ix_traceability_records_cut_ticket_id"), table_name="traceability_records"
    )
    op.drop_index(
        op.f("ix_traceability_records_carton_id"), table_name="traceability_records"
    )
    op.drop_table("traceability_records")
    op.drop_index(
        op.f("ix_quality_inspections_production_run_id"),
        table_name="quality_inspections",
    )
    op.drop_table("quality_inspections")
    op.drop_index(
        op.f("ix_production_outputs_worker_id"), table_name="production_outputs"
    )
    op.drop_index(
        op.f("ix_production_outputs_production_run_id"), table_name="production_outputs"
    )
    op.drop_table("production_outputs")
    op.drop_index(
        op.f("ix_efficiency_metrics_production_run_id"), table_name="efficiency_metrics"
    )
    op.drop_table("efficiency_metrics")
    op.drop_index(
        op.f("ix_production_runs_production_date"), table_name="production_runs"
    )
    op.drop_index(op.f("ix_production_runs_order_id"), table_name="production_runs")
    op.drop_index(op.f("ix_production_runs_line_id"), table_name="production_runs")
    op.drop_table("production_runs")
    op.drop_index(op.f("ix_cartons_packing_list_id"), table_name="cartons")
    op.drop_table("cartons")
    op.drop_index(
        op.f("ix_packing_lists_packing_list_number"), table_name="packing_lists"
    )
    op.drop_index(op.f("ix_packing_lists_order_id"), table_name="packing_lists")
    op.drop_table("packing_lists")
    op.drop_index(op.f("ix_cut_tickets_ticket_number"), table_name="cut_tickets")
    op.drop_index(op.f("ix_cut_tickets_order_id"), table_name="cut_tickets")
    op.drop_index(op.f("ix_cut_tickets_fabric_lot_id"), table_name="cut_tickets")
    op.drop_table("cut_tickets")
    op.drop_index(op.f("ix_processing_jobs_upload_id"), table_name="processing_jobs")
    op.drop_table("processing_jobs")
    op.drop_index(op.f("ix_parsed_datasets_upload_id"), table_name="parsed_datasets")
    op.drop_table("parsed_datasets")
    op.drop_index(op.f("ix_orders_style_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_status"), table_name="orders")
    op.drop_index(op.f("ix_orders_po_number"), table_name="orders")
    op.drop_table("orders")
    op.drop_index(op.f("ix_styles_style_number"), table_name="styles")
    op.drop_index(op.f("ix_styles_factory_id"), table_name="styles")
    op.drop_index(op.f("ix_styles_buyer"), table_name="styles")
    op.drop_table("styles")
    op.drop_index(op.f("ix_fabric_lots_supplier"), table_name="fabric_lots")
    op.drop_index(op.f("ix_fabric_lots_origin_country"), table_name="fabric_lots")
    op.drop_index(op.f("ix_fabric_lots_lot_number"), table_name="fabric_lots")
    op.drop_index(op.f("ix_fabric_lots_factory_id"), table_name="fabric_lots")
    op.drop_table("fabric_lots")
    op.drop_index(op.f("ix_excel_uploads_user_id"), table_name="excel_uploads")
    op.drop_index(op.f("ix_excel_uploads_factory_id"), table_name="excel_uploads")
    op.drop_table("excel_uploads")
    op.drop_index(op.f("ix_dhu_reports_report_date"), table_name="dhu_reports")
    op.drop_index(op.f("ix_dhu_reports_factory_id"), table_name="dhu_reports")
    op.drop_table("dhu_reports")
    op.drop_index(op.f("ix_worker_skills_worker_id"), table_name="worker_skills")
    op.drop_index(op.f("ix_worker_skills_operation"), table_name="worker_skills")
    op.drop_table("worker_skills")
    op.drop_index(
        op.f("ix_worker_attendances_worker_id"), table_name="worker_attendances"
    )
    op.drop_index(
        op.f("ix_worker_attendances_work_date"), table_name="worker_attendances"
    )
    op.drop_table("worker_attendances")
    op.drop_index(op.f("ix_users_organization_id"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_factories_organization_id"), table_name="factories")
    op.drop_table("factories")
    op.drop_index(op.f("ix_workers_factory_id"), table_name="workers")
    op.drop_index(op.f("ix_workers_employee_id"), table_name="workers")
    op.drop_table("workers")
    op.drop_index(op.f("ix_production_lines_factory_id"), table_name="production_lines")
    op.drop_table("production_lines")
    op.drop_table("organizations")
    # ### end Alembic commands ###
