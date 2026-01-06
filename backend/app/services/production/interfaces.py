from datetime import date
from typing import Protocol
from uuid import UUID

from app.models.production import Order


class ProductionRepository(Protocol):
    """
    Contract for data access in the production domain.
    Abstracts SQLAlchemy models to allow for easy mocking in tests.
    """

    def get_efficiency_by_line(
        self, line_id: UUID, date_range: tuple[date, date]
    ) -> float: ...

    def get_incomplete_orders(self) -> list[Order]: ...
