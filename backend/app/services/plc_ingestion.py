import asyncio
import json
import logging
from datetime import datetime, timezone
import uuid

# In a real app we'd use fastmqtt or aiomqtt. 
# For now we'll simulate the subscriber mechanism for the demo.
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db

logger = logging.getLogger(__name__)

# Assume REDIS_URL comes from settings
from app.core.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

class PLCIngestionService:
    def __init__(self):
        self.redis_client = redis_client

    async def handle_plc_event(self, payload_dict: dict):
        """
        Simulates the MQTT handler callback.
        In production, this is decorated with @mqtt.subscribe("factory/plc/telemetry")
        """
        try:
            # 1. Enrich payload
            payload_dict["ingested_at"] = datetime.now(timezone.utc).isoformat()
            payload_dict["event_id"] = str(uuid.uuid4())
            
            # Serialize
            payload_str = json.dumps(payload_dict)
            
            # 2. Push to Redis queue for background DB processing
            # This prevents the ingestion layer from waiting on slow DB inserts
            await self.redis_client.lpush("telemetry_queue", payload_str)
            
            # 3. Publish to Redis PubSub for real-time WebSocket broadcasting
            await self.redis_client.publish("telemetry_stream", payload_str)
            
            logger.debug(f"Successfully processed PLC event: {payload_dict['event_id']}")
            
        except Exception as e:
            logger.error(f"Error handling PLC event: {e}")

# Global instance
plc_ingestion_service = PLCIngestionService()

async def simulate_mqtt_traffic():
    """
    Mock generator for testing the pipeline locally.
    """
    import random
    
    while True:
        # Simulate a PLC event
        mock_event = {
            "data_source_id": "line_1",
            "order_id": str(uuid.uuid4()),
            "style_id": str(uuid.uuid4()),
            "event_type": "scan",
            "quantity": 1,
            "machine_id": f"sewing_m_{random.randint(1, 10)}",
            "is_mock": True # Critical UI flag requested by review
        }
        
        await plc_ingestion_service.handle_plc_event(mock_event)
        
        # Simulate 60 FPS (approx 16ms delay) across 60 lines
        # We'll use a slightly longer delay for local sanity (100ms)
        await asyncio.sleep(0.1)
