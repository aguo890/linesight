# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Check if data_source_id exists in database
"""

import asyncio

from sqlalchemy import select, text

from app.core.database import get_db_session
from app.models.datasource import DataSource


async def check():
    async with get_db_session() as db:
        # Get all data sources
        result = await db.execute(select(DataSource))
        sources = result.scalars().all()
        print(f"Total DataSources: {len(sources)}")
        for ds in sources:
            print(
                f"  ID: {ds.id}, Line: {ds.production_line_id}, Name: {ds.source_name}"
            )

        # Check for the specific ID
        target_id = "9ea8f6a4-05ef-467b-a057-b7eba674c821"
        result2 = await db.execute(
            text("SELECT * FROM data_sources WHERE id = :id"), {"id": target_id}
        )
        row = result2.fetchone()
        print(f"\nSearching for ID {target_id}: {'FOUND' if row else 'NOT FOUND'}")
        if row:
            print(f"  Row data: {dict(row._mapping)}")


asyncio.run(check())
