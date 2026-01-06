import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.getcwd())

from app.core.database import AsyncSessionLocal, async_engine
from app.db.seed import seed_data


async def main():
    print("Starting database seed...")
    async with AsyncSessionLocal() as session:
        try:
            await seed_data(session)
            print("Seeding completed successfully.")

            # Query the factory ID
            from sqlalchemy import select

            from app.models.factory import Factory

            result = await session.execute(select(Factory))
            factory = result.scalars().first()
            if factory:
                print(f"FACTORY ID: {factory.id}")
            else:
                print("No factory found!")

        except Exception as e:
            print(f"Seeding failed: {e}")
            raise
        finally:
            await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
