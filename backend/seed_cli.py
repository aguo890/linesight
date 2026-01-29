import asyncio
import logging
import sys

# Configure logging to show up in the terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# Add the current directory to sys.path so we can import 'app'
sys.path.append(".")

from app.core.database import AsyncSessionLocal, async_engine
from app.db.seed import seed_data


async def main():
    try:
        async with AsyncSessionLocal() as db:
            logger.info("🌱 Starting Database Seed (CLI Mode)...")
            await seed_data(db)
            logger.info("✅ Seeding Complete!")
    except Exception as e:
        logger.error(f"❌ Seeding Failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # Prevent "RuntimeError: Event loop is closed" by explicitly disposing engine
        await async_engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
