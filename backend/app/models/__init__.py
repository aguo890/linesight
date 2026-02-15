# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

# SQLAlchemy Models
from app.models.ai_decision import AIDecision
from app.models.alias_mapping import AliasMapping, AliasScope
from app.models.analytics import DHUReport, EfficiencyMetric
from app.models.base import Base
from app.models.dashboard import Dashboard
from app.models.data_quality import DataQualityIssue, IssueSeverity, IssueType
from app.models.datasource import DataSource, SchemaMapping
from app.models.events import EventType, ProductionEvent
from app.models.factory import Factory
from app.models.production import Order, ProductionRun, Style
from app.models.quality import Defect, QualityInspection
from app.models.raw_import import RawImport, StagingRecord
from app.models.user import Organization, RoleScope, User, UserRole, UserScope
from app.models.waitlist import Waitlist
from app.models.workforce import ProductionOutput, Worker, WorkerAttendance, WorkerSkill

# BACKWARD COMPATIBILITY ALIAS
# ProductionLine has been merged into DataSource
# Use DataSource instead for new code
ProductionLine = DataSource

# Draft/Archived Models (Required for recursive FKs in tests)
from app.models.drafts.cutting import CutTicket, FabricLot
from app.models.drafts.shipping import Carton, PackingList
from app.models.drafts.compliance import TraceabilityRecord

__all__ = [
    "Base",
    "Organization",
    "User",
    "UserScope",
    "UserRole",
    "RoleScope",
    "Factory",
    "ProductionLine",  # Alias for DataSource (backward compatibility)
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
    "Waitlist",
]
