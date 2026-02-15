# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.factory import Factory, ProductionLine


async def fix_missing_lines():
    async with AsyncSessionLocal() as db:
        print("\n=== Fixing Missing Lines ===")
        # Get all factories
        query = select(Factory)
        result = await db.execute(query)
        factories = result.scalars().all()

        for factory in factories:
            # Check line count
            line_query = select(ProductionLine).where(
                ProductionLine.factory_id == factory.id
            )
            line_result = await db.execute(line_query)
            lines = line_result.scalars().all()

            print(f"Factory: {factory.name} has {len(lines)} lines.")

            if len(lines) == 0:
                print(f"  -> Adding default lines to {factory.name}...")
                for i in range(1, 4):
                    new_line = ProductionLine(
                        factory_id=factory.id,
                        name=f"Line {i} ({factory.name})",
                        code=f"{factory.code or 'FAC'}-L{i}",
                        is_active=True,
                        target_efficiency_pct=85,
                    )
                    db.add(new_line)
                await db.commit()
                print("  -> Done.")
            else:
                print("  -> OK.")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(fix_missing_lines())
