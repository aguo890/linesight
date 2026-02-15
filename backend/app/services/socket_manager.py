# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
WebSocket Manager for Real-Time Dashboard Updates.
Handles connection management and broadcasting to connected clients.
"""

from collections import defaultdict

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        # Map line_id -> List[WebSocket]
        # Use "all" key for global listeners
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, line_id: str | None = None):
        """Accept connection and store it."""
        await websocket.accept()
        key = line_id or "all"
        self.active_connections[key].append(websocket)
        print(
            f"WS: Client connected to channel '{key}'. Total: {len(self.active_connections[key])}"
        )

    def disconnect(self, websocket: WebSocket, line_id: str | None = None):
        """Remove connection."""
        key = line_id or "all"
        if websocket in self.active_connections[key]:
            self.active_connections[key].remove(websocket)
            print(f"WS: Client disconnected from channel '{key}'.")

    async def broadcast(self, message: dict, line_id: str | None = None):
        """
        Broadcast message to relevant clients.
        If line_id is provided, send to that line's channel AND 'all'.
        """
        destinations = ["all"]
        if line_id:
            destinations.append(line_id)

        for dest in destinations:
            for connection in self.active_connections[dest]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"WS: Error broadcasting to {dest}: {e}")
                    # Cleanup dead connection?
                    # self.disconnect(connection, dest)
                    pass


manager = WebSocketManager()
