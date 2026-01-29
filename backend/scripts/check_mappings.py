
import asyncio
import os
import sys

# Fix path
sys.path.append(os.getcwd())  # noqa: E402

from app.db.session import AsyncSessionLocal
from sqlalchemy import select

from app.models.datasource import DataSource, SchemaMapping


async def check_mappings():
    async with AsyncSessionLocal() as db:
        stmt = (
            select(DataSource, SchemaMapping)
            .join(SchemaMapping, DataSource.id == SchemaMapping.data_source_id)
            .where(SchemaMapping.is_active)
        )
        result = await db.execute(stmt)
        rows = result.all()

        for ds, sm in rows:
            print(f"DataSource: {ds.id} ({ds.name})")
            print(f"Mapping Version: {sm.version}")
            print(f"Column Map: {sm.column_map}")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check_mappings())
