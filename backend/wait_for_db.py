# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import time
import sys
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from app.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)

def wait_for_db():
    """
    Waits for the database to become responsive.
    Uses app.core.config settings for the connection URL.
    """
    db_url = settings.sync_database_url
    
    # Sanity check
    if not db_url:
        logger.error("❌ DATABASE_URL is not set in environment or settings.")
        sys.exit(1)
        
    logger.info(f"⏳ Attempting to connect to database (Host: {settings.DB_HOST})...")
    
    # Create engine
    try:
        engine = create_engine(db_url, pool_pre_ping=True)
    except Exception as e:
        logger.error(f"❌ Failed to create DB engine: {e}")
        sys.exit(1)

    max_retries = 30
    retry_interval = 1
    
    for i in range(max_retries):
        try:
            # Context manager handles connection cleanup
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                logger.info("✅ Database is ready and accepting connections!")
                # Explicitly dispose engine to release resources before script exit
                engine.dispose()
                sys.exit(0)
        except (OperationalError, SQLAlchemyError) as e:
            if i % 5 == 0:
                logger.info(f"   Waiting for DB... ({i+1}/{max_retries}) - {str(e).split('[')[0]}")
            time.sleep(retry_interval)
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            sys.exit(1)
    
    logger.error("❌ Timeout waiting for database connection.")
    sys.exit(1)

if __name__ == "__main__":
    wait_for_db()
