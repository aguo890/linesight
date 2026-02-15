# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Background scheduler for periodic tasks.
Uses APScheduler for lightweight in-process scheduling.
"""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_maker
from app.services.dhu_aggregation import run_dhu_aggregation

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get a database session for scheduled jobs."""
    async with async_session_maker() as session:
        yield session


async def dhu_aggregation_job():
    """
    Scheduled job: Aggregate DHU reports.
    Runs daily to compute DHUReport entries from QualityInspection data.
    """
    logger.info("Starting scheduled DHU aggregation job")
    try:
        async with async_session_maker() as db:
            result = await run_dhu_aggregation(db, days_back=7)
            logger.info(f"DHU aggregation completed: {result}")
    except Exception as e:
        logger.error(f"DHU aggregation job failed: {e}", exc_info=True)


def init_scheduler() -> AsyncIOScheduler:
    """
    Initialize and configure the scheduler.

    Returns configured but not started scheduler.
    """
    global scheduler

    if scheduler is not None:
        return scheduler

    scheduler = AsyncIOScheduler()

    # DHU Aggregation: Run every hour at minute 15
    # This ensures data is fresh without overwhelming the system
    scheduler.add_job(
        dhu_aggregation_job,
        CronTrigger(minute=15),  # Every hour at :15
        id="dhu_aggregation",
        name="DHU Report Aggregation",
        replace_existing=True,
    )

    logger.info("Scheduler configured with DHU aggregation job (hourly at :15)")
    return scheduler


def start_scheduler():
    """Start the scheduler if not already running."""
    global scheduler
    if scheduler is None:
        scheduler = init_scheduler()

    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started")


def shutdown_scheduler():
    """Gracefully shutdown the scheduler."""
    global scheduler
    if scheduler is not None and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")


@asynccontextmanager
async def scheduler_lifespan():
    """
    Context manager for scheduler lifecycle.
    Use with FastAPI lifespan.
    """
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()
