# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

# Pydantic Schemas
from app.schemas.dashboard import (
    DashboardCreate,
    DashboardDetailResponse,
    DashboardListResponse,
    DashboardResponse,
    DashboardUpdate,
    LayoutConfig,
    LayoutItem,
    SuggestedWidget,
    WidgetConfig,
    WidgetSuggestionsResponse,
)

# ProductionLine* aliases are in datasource.py
from app.schemas.datasource import (
    DataSourceCreate,
    DataSourceRead,
    DataSourceSettings,
    DataSourceUpdate,
    ProductionLineCreate,
    ProductionLineRead,
    ProductionLineUpdate,
)
from app.schemas.factory import (
    FactoryCreate,
    FactoryRead,
    FactoryUpdate,
    FactoryWithDataSources,
    FactoryWithLines,  # Backward compatibility alias
)
from app.schemas.ingestion import (
    AvailableField,
    ColumnMappingConfirmation,
    ColumnMappingResult,
    ConfirmMappingRequest,
    ConfirmMappingResponse,
    DryRunResponse,
    DryRunRow,
    ProcessingResponse,
    RawImportUploadResponse,
)
from app.schemas.production import (
    OrderCreate,
    OrderRead,
    OrderUpdate,
    ProductionRunCreate,
    ProductionRunRead,
    ProductionRunUpdate,
    StyleCreate,
    StyleRead,
    StyleUpdate,
)
from app.schemas.upload import (
    ColumnMapping,
    ParseResult,
    ProcessingJobRead,
    ProcessingJobStatus,
    UploadRead,
    UploadResponse,
)
from app.schemas.user import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    Token,
    TokenPayload,
    UserCreate,
    UserLogin,
    UserRead,
    UserUpdate,
)

__all__ = [
    # User/Org
    "OrganizationCreate",
    "OrganizationRead",
    "OrganizationUpdate",
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "UserLogin",
    "Token",
    "TokenPayload",
    # Factory
    "FactoryCreate",
    "FactoryRead",
    "FactoryUpdate",
    "FactoryWithLines",
    "FactoryWithDataSources",
    "ProductionLineCreate",
    "ProductionLineRead",
    "ProductionLineUpdate",
    # Upload
    "UploadResponse",
    "UploadRead",
    "ProcessingJobRead",
    "ProcessingJobStatus",
    "ColumnMapping",
    "ParseResult",
    # Production
    "StyleCreate",
    "StyleRead",
    "StyleUpdate",
    "OrderCreate",
    "OrderRead",
    "OrderUpdate",
    "ProductionRunCreate",
    "ProductionRunRead",
    "ProductionRunUpdate",
    # Dashboard
    "DashboardCreate",
    "DashboardUpdate",
    "DashboardResponse",
    "DashboardDetailResponse",
    "DashboardListResponse",
    "SuggestedWidget",
    "WidgetSuggestionsResponse",
    "WidgetConfig",
    "LayoutConfig",
    "LayoutItem",
    # Ingestion (HITL Flow)
    "ColumnMappingResult",
    "ProcessingResponse",
    "ColumnMappingConfirmation",
    "ConfirmMappingRequest",
    "ConfirmMappingResponse",
    "AvailableField",
    "DryRunRow",
    "DryRunResponse",
    "RawImportUploadResponse",

    # DataSource
    "DataSourceCreate",
    "DataSourceRead",
    "DataSourceSettings",
    "DataSourceUpdate",
]
