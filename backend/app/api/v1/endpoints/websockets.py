# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.socket_manager import manager
from app.services.plc_ingestion import redis_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/dashboard/{client_id}")
async def websocket_dashboard(
    websocket: WebSocket, client_id: str, line_id: str | None = None
):
    """
    WebSocket endpoint for real-time dashboard updates.
    Client can optionally specify 'line_id' query parameter to subscribe to specific line.
    """
    # Accept connection
    await manager.connect(websocket, line_id)
    
    # Subscribe to Redis telemetry stream
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("telemetry_stream")
    
    try:
        while True:
            # Check for new telemetry
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message and message["type"] == "message":
                event_data = json.loads(message["data"])
                
                # Filter by line_id if client requested a specific line
                if not line_id or event_data.get("data_source_id") == line_id:
                    await websocket.send_json(event_data)
            else:
                # Prevent tight loop
                await asyncio.sleep(0.1)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, line_id)
        await pubsub.unsubscribe("telemetry_stream")
