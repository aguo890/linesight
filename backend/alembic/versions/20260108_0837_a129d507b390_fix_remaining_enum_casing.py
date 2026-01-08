"""fix_remaining_enum_casing

Revision ID: a129d507b390
Revises: 9e343c0dcd92
Create Date: 2026-01-08 08:37:44.640868+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a129d507b390'
down_revision: Union[str, None] = '9e343c0dcd92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user_scopes.scope_type (RoleScope)
    op.alter_column('user_scopes', 'scope_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE user_scopes SET scope_type = LOWER(scope_type)")
    op.alter_column('user_scopes', 'scope_type', 
                    type_=sa.Enum('organization', 'factory', 'line', name='rolescope'),
                    existing_nullable=False)

    # 2. ai_decisions.agent_type (AgentType)
    op.alter_column('ai_decisions', 'agent_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE ai_decisions SET agent_type = LOWER(agent_type)")
    op.alter_column('ai_decisions', 'agent_type', 
                    type_=sa.Enum('schema_inference', 'code_generation', name='agenttype'),
                    existing_nullable=False)

    # 3. production_events.event_type (EventType)
    op.alter_column('production_events', 'event_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE production_events SET event_type = LOWER(event_type)")
    op.alter_column('production_events', 'event_type', 
                    type_=sa.Enum('scan', 'batch_upload', 'manual_adjustment', 'iot_signal', name='eventtype', native_enum=False),
                    existing_nullable=False)

    # 4. quality_inspections.inspection_type (InspectionType)
    op.alter_column('quality_inspections', 'inspection_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE quality_inspections SET inspection_type = LOWER(inspection_type)")
    op.alter_column('quality_inspections', 'inspection_type', 
                    type_=sa.Enum('inline', 'endline', 'final', 'aql', name='inspectiontype'),
                    existing_nullable=False)

    # 5. quality_inspections.aql_result (AQLResult) - Nullable
    op.alter_column('quality_inspections', 'aql_result', type_=sa.String(50), existing_nullable=True)
    op.execute("UPDATE quality_inspections SET aql_result = LOWER(aql_result)")
    op.alter_column('quality_inspections', 'aql_result', 
                    type_=sa.Enum('pass', 'fail', 'pending', name='aqlresult'),
                    existing_nullable=True)

    # 6. defects.severity (DefectSeverity)
    op.alter_column('defects', 'severity', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE defects SET severity = LOWER(severity)")
    op.alter_column('defects', 'severity', 
                    type_=sa.Enum('minor', 'major', 'critical', name='defectseverity'),
                    existing_nullable=False)


def downgrade() -> None:
    # Reverting is tricky because we can't easily uppercase everything if we don't know the exact mapping (some might be mixed).
    # Ideally, we should not revert to the "broken" uppercase state, but technically downgrade should reverse upgrade.
    # Given this is a fix migration, I'll basically do the reverse: Uppercase everything.
    
    # 6
    op.alter_column('defects', 'severity', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE defects SET severity = UPPER(severity)")
    op.alter_column('defects', 'severity', 
                    type_=sa.Enum('MINOR', 'MAJOR', 'CRITICAL', name='defectseverity'),
                    existing_nullable=False)
    
    # 5
    op.alter_column('quality_inspections', 'aql_result', type_=sa.String(50), existing_nullable=True)
    op.execute("UPDATE quality_inspections SET aql_result = UPPER(aql_result)")
    op.alter_column('quality_inspections', 'aql_result', 
                    type_=sa.Enum('PASS', 'FAIL', 'PENDING', name='aqlresult'),
                    existing_nullable=True)

    # 4
    op.alter_column('quality_inspections', 'inspection_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE quality_inspections SET inspection_type = UPPER(inspection_type)")
    op.alter_column('quality_inspections', 'inspection_type', 
                    type_=sa.Enum('INLINE', 'ENDLINE', 'FINAL', 'AQL', name='inspectiontype'),
                    existing_nullable=False)

    # 3
    op.alter_column('production_events', 'event_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE production_events SET event_type = UPPER(event_type)")
    op.alter_column('production_events', 'event_type', 
                    type_=sa.Enum('SCAN', 'BATCH_UPLOAD', 'MANUAL_ADJUSTMENT', 'IOT_SIGNAL', name='eventtype', native_enum=False),
                    existing_nullable=False)

    # 2
    op.alter_column('ai_decisions', 'agent_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE ai_decisions SET agent_type = UPPER(agent_type)")
    op.alter_column('ai_decisions', 'agent_type', 
                    type_=sa.Enum('SCHEMA_INFERENCE', 'CODE_GENERATION', name='agenttype'),
                    existing_nullable=False)

    # 1
    op.alter_column('user_scopes', 'scope_type', type_=sa.String(50), existing_nullable=False)
    op.execute("UPDATE user_scopes SET scope_type = UPPER(scope_type)")
    op.alter_column('user_scopes', 'scope_type', 
                    type_=sa.Enum('ORGANIZATION', 'FACTORY', 'LINE', name='rolescope'),
                    existing_nullable=False)
