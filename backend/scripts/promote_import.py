# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import asyncio
import os
import sys

# Add parent directory to path
sys.path.append(os.getcwd())

from app.core.database import AsyncSessionLocal
from app.services.file_processor import FileProcessingService


async def promote_latest_import():
    raw_import_id = "b0c37b61-9ab9-49aa-a887-c2f5b04ed019"

    print(f"🚀 Promoting Import ID: {raw_import_id}...")

    async with AsyncSessionLocal() as db:
        processor = FileProcessingService(db)
        try:
            result = await processor.promote_to_production(raw_import_id)
            await db.commit()
            print("✅ Promotion Successful!")
            print(f"   Records Processed: {result.get('records_processed')}")
            print(f"   Success Count: {result.get('success_count')}")
            print(f"   Error Count: {result.get('error_count')}")
        except Exception as e:
            print(f"❌ Promotion Failed: {e}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(promote_latest_import())
