import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.socket_manager import manager

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
    try:
        while True:
            # Keep alive loop
            data = await websocket.receive_text()
            # Optional: handle client messages (ping/subscription change)
            logger.debug(f"WS client {client_id} sent: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, line_id)
