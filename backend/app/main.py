"""
LineSight - FastAPI Application Entry Point

AI-driven digital transformation platform for SMB apparel manufacturing.
Semantic ETL for Excel files with LLM-powered data cleaning.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import AppException, app_exception_handler
from app.core.logging import get_logger, setup_logging

# Setup logging on module load
setup_logging()
logger = get_logger(__name__)

# Silence SQLAlchemy's SQL statement logging in production
# Even with echo=False, the logging module can capture engine events at INFO level
import logging as _logging  # noqa: E402

_logging.getLogger("sqlalchemy.engine").setLevel(_logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Database: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    logger.info(f"LLM Provider: {settings.LLM_PROVIDER}")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")


def create_application() -> FastAPI:
    """Application factory for creating FastAPI instance."""

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "LineSight: AI-driven Semantic ETL platform for SMB apparel manufacturing. "
            "Parse messy Excel files, track SAM/DHU metrics, and ensure UFLPA compliance."
        ),
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
        swagger_ui_parameters={
            "defaultModelsExpandDepth": -1,  # Hide schemas section at bottom
            "persistAuthorization": True,  # Keep auth token on page refresh
        },
    )

    # Register exception handlers
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]

    # Global error handlers for common database and validation errors
    from fastapi import Request
    from fastapi.responses import JSONResponse
    from sqlalchemy.exc import IntegrityError

    @app.exception_handler(IntegrityError)
    async def sqlalchemy_integrity_handler(request: Request, exc: Exception):
        """Handle database integrity constraint violations (e.g., duplicates, FK violations)."""
        logger.error(f"IntegrityError: {exc}")
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Data conflict: This record already exists or violates a database constraint.",
                "code": "DUPLICATE_ENTRY",
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        """Handle value errors from business logic validation."""
        logger.error(f"ValueError: {exc}")
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc), "code": "INVALID_INPUT"},
        )

    # Additional common exception handler
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Catch-all handler for unexpected exceptions."""
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An unexpected error occurred. Please contact support if the problem persists.",
                "code": "INTERNAL_ERROR",
            },
        )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Debug Toolbar (only in development)
    if settings.DEBUG:
        from debug_toolbar.middleware import DebugToolbarMiddleware

        app.add_middleware(
            DebugToolbarMiddleware,  # type: ignore[arg-type]
            panels=["debug_toolbar.panels.sqlalchemy.SQLAlchemyPanel"],
        )

    # Register API v1 router
    from app.api.v1.router import api_router

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/", tags=["Health"])
    async def root():
        """Root endpoint - API health check."""
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "healthy",
            "docs": "/docs",
        }

    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint for monitoring."""
        return {"status": "ok"}

    return app


# Create application instance
app = create_application()
