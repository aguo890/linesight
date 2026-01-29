"""Add composite unique constraint for quality inspections.

Revision ID: a7b9c1d2e3f4
Revises: c16cc34a52cb
Create Date: 2026-01-29 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a7b9c1d2e3f4'
down_revision: Union[str, None] = 'c16cc34a52cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite unique constraint on (production_run_id, inspection_type).
    
    This enables UPSERT operations on quality_inspections to work correctly.
    Each production run can have one inspection per type (INLINE, ENDLINE, FINAL, AQL).
    """
    op.create_unique_constraint(
        'uq_quality_inspection_run_type',
        'quality_inspections',
        ['production_run_id', 'inspection_type']
    )


def downgrade() -> None:
    """Remove the composite unique constraint."""
    op.drop_constraint(
        'uq_quality_inspection_run_type',
        'quality_inspections',
        type_='unique'
    )
