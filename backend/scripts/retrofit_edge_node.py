import asyncio
import time
import json
import redis
import logging
from collections import deque
from datetime import datetime
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants for Store & Forward
LOCAL_BUFFER_MAX = 10000
REDIS_QUEUE_KEY = "retrofit_telemetry_queue"
# Adjust to your central Redis/Cloud instance IP
REDIS_HOST = "localhost" 

# Software Debouncing Constraints
DEBOUNCE_FLICK_THRESHOLD = 0.100  # <100ms: flick
DEBOUNCE_BLOCK_THRESHOLD = 1.000  # >1000ms: block/tape (fraud)

class MockGPIO:
    """Mock edge sensor interface simulating a laser breakout system."""
    def __init__(self):
        self.state = 0
        self.last_change_time = time.time()

    def read_sensor(self):
        return self.state

    def trigger_break(self, duration: float):
        """Helper to simulate sensor activity for tests."""
        self.state = 1
        time.sleep(duration)
        self.state = 0

class RetrofitEdgeNode:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.gpio = MockGPIO()
        
        # Store and Forward local deque
        self.local_buffer = deque(maxlen=LOCAL_BUFFER_MAX)
        self.redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)
        
        # Internal state
        self.part_count = 0
        self.fraud_suspected = False
        self.fraud_reason = None
        self.bundle_active = False

    def process_sensor_break(self, duration: float) -> Optional[int]:
        """
        Applies software debouncing to pure physical hardware signals.
        Returns the new part_count if valid, otherwise None.
        """
        if duration < DEBOUNCE_FLICK_THRESHOLD:
            logger.debug(f"[Hardware Anomaly] Ignored break of {duration}s as a 'flick'.")
            return None
        elif duration > DEBOUNCE_BLOCK_THRESHOLD:
            logger.warning(f"[Hardware Anomaly] Sensor blocked for {duration}s! Possible tampering/tape.")
            self.fraud_suspected = True
            self.fraud_reason = f"Sensor blocked for > {DEBOUNCE_BLOCK_THRESHOLD}s. Tampering suspected."
            return None
        else:
            # Valid part counted
            self.part_count += 1
            return self.part_count

    def buffer_event(self, event_type: str):
        """Saves event to the local resilient buffer."""
        event = {
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "device_id": self.device_id,
            "part_count": self.part_count,
            "fraud_suspected": self.fraud_suspected,
            "fraud_reason": self.fraud_reason
        }
        self.local_buffer.append(event)
        logger.info(f"Buffered Local Event: {event_type} | Count: {self.part_count}")
    
    def forward_events(self):
        """Store & Forward mechanism to push queued events to Redis."""
        events_processed = 0
        while self.local_buffer:
            event = self.local_buffer[0]
            try:
                # Use LPUSH to add to the queue (Worker will RPOP)
                self.redis_client.lpush(REDIS_QUEUE_KEY, json.dumps(event))
                self.local_buffer.popleft() # Safely remove only on success
                events_processed += 1
            except redis.ConnectionError:
                logger.warning("[Network Resilience] Redis/Cloud offline. Retaining events in local buffer.")
                break
        
        if events_processed > 0:
            logger.info(f"Forwarded {events_processed} events to Cloud.")

    async def simulate_production_run(self):
        """Main loop to simulate sensor behavior during a bundle."""
        logger.info(f"Starting Production Run on Edge Node: {self.device_id}")
        
        # 1. Start Bundle
        self.bundle_active = True
        self.part_count = 0
        self.buffer_event("BUNDLE_STARTED")
        self.forward_events()

        # 2. Simulate Valid Parts (e.g. 500ms breaks)
        for _ in range(3):
            await asyncio.sleep(0.5)
            if self.process_sensor_break(0.5):
                self.buffer_event("PART_COUNTED")
                self.forward_events()

        # 3. Simulate Hardware Anomaly: Flick (50ms)
        await asyncio.sleep(0.5)
        self.process_sensor_break(0.05)
        
        # 4. Simulate Hardware Anomaly: Block/Tamper (1.5s)
        await asyncio.sleep(0.5)
        self.process_sensor_break(1.50)

        # 5. Complete Bundle
        self.buffer_event("BUNDLE_COMPLETED")
        self.forward_events()
        
        # Reset State
        self.bundle_active = False
        self.part_count = 0
        self.fraud_suspected = False
        self.fraud_reason = None
        logger.info("Production Run Completed.")

if __name__ == "__main__":
    node = RetrofitEdgeNode(device_id="GATEWAY_A1")
    asyncio.run(node.simulate_production_run())
