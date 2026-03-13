import json
import logging
import redis
from celery import shared_task
from app.schemas.telemetry import TelemetryEvent, BundleEventType
from app.core.config import settings
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

REDIS_QUEUE_KEY = "retrofit_telemetry_queue"

def persist_bundle_to_db(event: TelemetryEvent, db_session):
    """
    Mock implementation of DB persistence.
    In a real system, you'd insert a Bundle record, matching device_id and timestamp.
    """
    logger.info(f"[DB Write] Persisting completed bundle for {event.device_id} (count: {event.part_count}).")
    # For idempotency, we would check if this bundle was already inserted using a unique identifier.
    # if not bundle_exists:
    #     db_session.add(models.Bundle(...))
    #     db_session.commit()

@shared_task(name="process_retrofit_telemetry", bind=True, max_retries=3)
def process_retrofit_telemetry(self):
    """
    Celery background worker to pop events from the Redis store-and-forward queue.
    Only writes to the SQL database on BUNDLE_COMPLETED to protect integrity 
    and avoid N+1 issues for high frequency PART_COUNTED events.
    """
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    db = SessionLocal()
    
    try:
        # Batch process up to 100 queued items per task execution
        for _ in range(100):
            # Use RPOP because edge node uses LPUSH (FIFO queue)
            item = redis_client.rpop(REDIS_QUEUE_KEY)
            
            if not item:
                # Queue empty
                break
                
            try:
                event_data = json.loads(item)
                event = TelemetryEvent(**event_data)
                
                # Check constraints: Only hit DB on completion
                if event.event_type == BundleEventType.BUNDLE_COMPLETED:
                    # Execute DB transation
                    persist_bundle_to_db(event, db)
                else:
                    # PART_COUNTED or BUNDLE_STARTED: Intermediate state
                    # These might be pushed to WebSockets by another pub/sub worker, 
                    # but should NOT hit Postgres to avoid N+1 slowdowns.
                    logger.debug(f"Skipping DB write for intermediate event: {event.event_type}")
                    
            except Exception as parse_exc:
                logger.error(f"Failed to parse or process telemetry event payload '{item}'. Error: {parse_exc}")
                # We could send unparseable messages to a Dead Letter Queue (DLQ) here
    except Exception as e:
        logger.error(f"Worker encountered an unexpected error: {e}")
        raise self.retry(exc=e)
    finally:
        db.close()
