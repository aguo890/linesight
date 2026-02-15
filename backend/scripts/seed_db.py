# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
CLI script to seed the database.
Usage: python scripts/seed_db.py
"""

import asyncio
import os
import sys

# Add the parent directory to sys.path to allow importing from 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.db.seed import seed_data


async def main():
    print("Starting database seeding...")
    async with AsyncSessionLocal() as db:
        await seed_data(db)
    print("Seeding finished successfully.")


if __name__ == "__main__":
    asyncio.run(main())
