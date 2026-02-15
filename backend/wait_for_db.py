
import time
import sys
import logging
from sqlalchemy import create_engine, text
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def wait_for_db():
    logger.info("⏳ Attempting to connect to database...")
    
    # Create engine safely
    try:
        engine = create_engine(settings.sync_database_url)
    except Exception as e:
        logger.error(f"❌ Failed to create engine: {e}")
        sys.exit(1)

    max_retries = 30
    retry_interval = 1
    
    for i in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                logger.info("✅ Database is ready and accepting connections!")
                sys.exit(0)
        except Exception as e:
            if i % 5 == 0:
                logger.info(f"   Waiting for DB... ({i}/{max_retries})")
            time.sleep(retry_interval)
    
    logger.error("❌ Timeout waiting for database connection.")
    sys.exit(1)

if __name__ == "__main__":
    wait_for_db()
