# SQLAlchemy Models
from app.models.ai_decision import AIDecision
from app.models.alias_mapping import AliasMapping, AliasScope
from app.models.analytics import DHUReport, EfficiencyMetric
from app.models.base import Base
from app.models.dashboard import Dashboard
from app.models.data_quality import DataQualityIssue, IssueSeverity, IssueType
from app.models.datasource import DataSource, SchemaMapping
from app.models.events import EventType, ProductionEvent
from app.models.factory import Factory, ProductionLine
from app.models.production import Order, ProductionRun, Style
from app.models.quality import Defect, QualityInspection
from app.models.raw_import import RawImport, StagingRecord
from app.models.user import Organization, RoleScope, User, UserRole, UserScope
from app.models.workforce import ProductionOutput, Worker, WorkerAttendance, WorkerSkill

# ARCHIVED MODELS (see models/drafts/):
# - cutting.py: FabricLot, CutTicket
# - shipping.py: PackingList, Carton
# - compliance.py: TraceabilityRecord

__all__ = [
    "Base",
    "Organization",
    "User",
    "UserScope",
    "UserRole",
    "RoleScope",
    "Factory",
    "ProductionLine",
    "DataSource",
    "SchemaMapping",
    "Dashboard",
    "Style",
    "Order",
    "ProductionRun",
    "QualityInspection",
    "Defect",
    "Worker",
    "WorkerSkill",
    "WorkerAttendance",
    "ProductionOutput",
    "EfficiencyMetric",
    "DHUReport",
    "AIDecision",
    # HITL Models
    "RawImport",
    "StagingRecord",
    "AliasMapping",
    "AliasScope",
    # Data Quality
    "DataQualityIssue",
    "IssueSeverity",
    "IssueType",
    "ProductionEvent",
    "EventType",
]
