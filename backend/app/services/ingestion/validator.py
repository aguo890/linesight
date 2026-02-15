# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Record Validator - Relationship Resolution Layer.
Extracted from file_processor.py to handle Style/Order resolution.
"""
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production import Order, ProductionRun, Style


class RecordValidator:
    """
    Handles validation and relationship resolution for ingested records.
    Responsibilities:
    - Resolve/create Style records
    - Resolve/create Order records
    - Fetch existing ProductionRuns for differential updates
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def resolve_styles(
        self, records: list[dict[str, Any]], factory_id: str
    ) -> dict[str, Style]:
        """
        Batch resolve/create Style records using WHERE IN query.
        Returns a mapping of style_number -> Style object.
        """
        # Extract unique style numbers
        style_numbers = set()
        for record in records:
            sn = record.get("style_number")
            if sn:
                style_numbers.add(str(sn))

        if not style_numbers:
            return {}

        # Fetch existing styles in one query
        result = await self.db.execute(
            select(Style).where(
                Style.style_number.in_(style_numbers),
                Style.factory_id == factory_id,
            )
        )
        existing_styles = {s.style_number: s for s in result.scalars().all()}

        # Create missing styles
        missing = style_numbers - set(existing_styles.keys())
        for style_number in missing:
            # Find first record with this style to get defaults
            defaults = next(
                (r for r in records if r.get("style_number") == style_number), {}
            )
            new_style = Style(
                factory_id=factory_id,
                style_number=style_number,
                description=defaults.get("description"),
                buyer=defaults.get("buyer"),
                season=defaults.get("season"),
                base_sam=defaults.get("sam"),
            )
            self.db.add(new_style)
            existing_styles[style_number] = new_style

        await self.db.flush()
        return existing_styles

    async def resolve_orders(
        self, records: list[dict[str, Any]], style_map: dict[str, Style]
    ) -> dict[tuple[str, str], Order]:
        """
        Batch resolve/create Order records using WHERE IN query.
        Returns a mapping of (po_number, style_id) -> Order object.
        """
        # Extract unique (po_number, style_id) pairs
        order_keys = set()
        for record in records:
            po = record.get("po_number", "UNKNOWN_PO")
            sn = record.get("style_number")
            if sn and sn in style_map:
                order_keys.add((str(po), style_map[sn].id))

        if not order_keys:
            return {}

        # Fetch existing orders - need to handle composite key lookup
        po_numbers = [k[0] for k in order_keys]
        style_ids = [k[1] for k in order_keys]

        result = await self.db.execute(
            select(Order).where(
                Order.po_number.in_(po_numbers),
                Order.style_id.in_(style_ids),
            )
        )
        existing_orders = {(o.po_number, o.style_id): o for o in result.scalars().all()}

        # Create missing orders
        missing = order_keys - set(existing_orders.keys())
        for po_number, style_id in missing:
            # Find first record with this PO to get defaults
            defaults = next(
                (r for r in records if r.get("po_number", "UNKNOWN_PO") == po_number),
                {},
            )
            new_order = Order(
                po_number=po_number,
                style_id=style_id,
                quantity=defaults.get("planned_qty", 0),
            )
            self.db.add(new_order)
            existing_orders[(po_number, style_id)] = new_order

        await self.db.flush()
        return existing_orders

    async def resolve_existing_runs(
        self,
        records: list[dict[str, Any]],
        style_map: dict[str, Style],
        order_map: dict[tuple[str, str], Order],
        data_source_id: str,
    ) -> dict[tuple[str, date, str], ProductionRun]:
        """
        Batch fetch existing ProductionRuns to enable differential updates.
        Returns map: (order_id, production_date, shift) -> ProductionRun
        """
        from sqlalchemy import func

        criteria = set()
        for record in records:
            # Resolve Order ID
            sn = record.get("style_number")
            po = record.get("po_number", "UNKNOWN_PO")
            if not sn or sn not in style_map:
                continue
            style = style_map[sn]
            if (str(po), style.id) not in order_map:
                continue
            order = order_map[(str(po), style.id)]

            # Key
            p_date = record.get("production_date")
            if isinstance(p_date, datetime):
                p_date = p_date.date()
            shift = record.get("shift", "day")

            criteria.add((order.id, p_date, shift))

        if not criteria:
            return {}

        # Build Query: Filter by line, orders, and dates to narrow down
        dates = {c[1] for c in criteria}
        order_ids = {c[0] for c in criteria}

        stmt = select(ProductionRun).where(
            ProductionRun.data_source_id == data_source_id,
            ProductionRun.order_id.in_(order_ids),
            func.date(ProductionRun.production_date).in_(dates),
        )
        result = await self.db.execute(stmt)
        runs = result.scalars().all()

        run_map = {}
        for run in runs:
            r_date = (
                run.production_date.date()
                if isinstance(run.production_date, datetime)
                else run.production_date
            )
            key = (run.order_id, r_date, run.shift)
            run_map[key] = run

        return run_map
