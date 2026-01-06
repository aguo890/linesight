"""
Standardized Service Result pattern.
Improves predictability and error handling in the service layer.
"""

from typing import Any, Generic, TypeVar

T = TypeVar("T")


class ServiceResult(Generic[T]):
    """
    Standardized result for service layer methods.

    Attributes:
        success: Whether the operation was successful.
        data: The payload returned on success.
        error_code: A machine-readable error code if failed.
        message: A human-readable error message if failed.
        context: Additional context for the error or result.
    """

    def __init__(
        self,
        success: bool,
        data: T | None = None,
        error_code: str | None = None,
        message: str | None = None,
        context: dict[str, Any] | None = None,
    ):
        self.success = success
        self.data = data
        self.error_code = error_code
        self.message = message
        self.context = context or {}

    @classmethod
    def ok(cls, data: T) -> "ServiceResult[T]":
        """Create a successful result."""
        return cls(success=True, data=data)

    @classmethod
    def failure(
        cls,
        error_code: str,
        message: str = "Operation failed",
        context: dict[str, Any] | None = None,
    ) -> "ServiceResult[Any]":
        """Create a failed result."""
        return cls(
            success=False, error_code=error_code, message=message, context=context
        )

    def __bool__(self) -> bool:
        """Allow implicit boolean check (if result: ...)."""
        return self.success
