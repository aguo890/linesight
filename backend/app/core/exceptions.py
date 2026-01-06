"""
Custom exceptions and error handlers for LineSight.
Provides consistent error responses across the API.
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    """Standard error response schema."""

    detail: str
    error_code: str | None = None
    context: dict[str, Any] | None = None


class AppException(Exception):  # noqa: N818
    """Base exception for application errors."""

    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: str = "An unexpected error occurred",
        error_code: str | None = None,
        context: dict[str, Any] | None = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.context = context or {}
        super().__init__(self.detail)


class NotFoundError(AppException):
    """Resource not found error."""

    def __init__(self, resource: str, identifier: Any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found",
            error_code="NOT_FOUND",
            context={"resource": resource, "id": str(identifier)},
        )


class ValidationError(AppException):
    """Validation error for business logic."""

    def __init__(self, detail: str, field: str | None = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
            error_code="VALIDATION_ERROR",
            context={"field": field} if field else {},
        )


class PermissionDeniedError(AppException):
    """Permission denied error."""

    def __init__(self, action: str = "perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to {action}",
            error_code="PERMISSION_DENIED",
        )


class ConflictError(AppException):
    """Resource conflict error (e.g., duplicate)."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="CONFLICT",
        )


class ExternalServiceError(AppException):
    """External service (LLM, etc.) error."""

    def __init__(self, service: str, detail: str):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"External service error: {detail}",
            error_code="EXTERNAL_SERVICE_ERROR",
            context={"service": service},
        )


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle AppException and subclasses."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.error_code,
            "context": exc.context,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions in production."""
    # Log the full exception here
    import logging

    logging.exception("Unhandled exception")

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred",
            "error_code": "INTERNAL_ERROR",
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register all exception handlers with the FastAPI app."""
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
    # Only add generic handler in production
    # app.add_exception_handler(Exception, generic_exception_handler)
