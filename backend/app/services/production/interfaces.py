# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

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
