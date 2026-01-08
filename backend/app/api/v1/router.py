"""
API v1 Router aggregator.
Includes all endpoint routers for the v1 API.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai_decisions,
    analytics,
    auth,
    dashboards,
    datasource,
    dev,
    factories,
    ingestion,
    organizations,
    production,
    samples,
    team,
    users,
    websockets,
)
from app.core.config import settings

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(
    ingestion.router, tags=["Data Ingestion"]
)  # HITL ingestion flow
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["Dashboards"])
api_router.include_router(factories.router, prefix="/factories", tags=["Factories"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
# Team router must come BEFORE organizations router
# because organizations has /{organization_id} which would catch /members
api_router.include_router(
    team.router, prefix="/organizations", tags=["Team Management"]
)
api_router.include_router(
    organizations.router, prefix="/organizations", tags=["Organizations"]
)
api_router.include_router(production.router, prefix="/production", tags=["Production"])
api_router.include_router(datasource.router, tags=["Data Sources"])
api_router.include_router(ai_decisions.router, tags=["AI Decisions"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(samples.router, prefix="/samples", tags=["Sample Data"])
api_router.include_router(websockets.router, prefix="/ws", tags=["WebSockets"])

if settings.ENVIRONMENT != "production":
    api_router.include_router(dev.router, prefix="/dev", tags=["Development"])
# Force reload
