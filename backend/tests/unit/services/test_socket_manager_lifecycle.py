# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

"""
Socket Manager Lifecycle Tests
Sweeps the missing 48% in socket_manager.py.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.socket_manager import WebSocketManager


class TestWebSocketManager:
    """Test WebSocket manager connection lifecycle."""

    @pytest.fixture
    def manager(self):
        return WebSocketManager()

    @pytest.mark.asyncio
    async def test_connect_without_line_id(self, manager):
        """Test connecting without a line_id goes to 'all' channel."""
        websocket = AsyncMock()

        await manager.connect(websocket)

        assert websocket.accept.called
        assert websocket in manager.active_connections["all"]

    @pytest.mark.asyncio
    async def test_connect_with_line_id(self, manager):
        """Test connecting with a line_id goes to that channel."""
        websocket = AsyncMock()
        line_id = "line-123"

        await manager.connect(websocket, line_id)

        assert websocket.accept.called
        assert websocket in manager.active_connections[line_id]

    def test_disconnect_without_line_id(self, manager):
        """Test disconnecting without a line_id removes from 'all' channel."""
        websocket = AsyncMock()
        manager.active_connections["all"].append(websocket)

        manager.disconnect(websocket)

        assert websocket not in manager.active_connections["all"]

    def test_disconnect_with_line_id(self, manager):
        """Test disconnecting with a line_id removes from that channel."""
        websocket = AsyncMock()
        line_id = "line-123"
        manager.active_connections[line_id].append(websocket)

        manager.disconnect(websocket, line_id)

        assert websocket not in manager.active_connections[line_id]

    def test_disconnect_not_in_list(self, manager):
        """Test disconnecting a websocket that's not in the list doesn't crash."""
        websocket = AsyncMock()

        # Should not raise
        manager.disconnect(websocket)
        manager.disconnect(websocket, "line-123")

    @pytest.mark.asyncio
    async def test_broadcast_to_all(self, manager):
        """Test broadcasting sends to 'all' channel."""
        websocket1 = AsyncMock()
        websocket2 = AsyncMock()
        manager.active_connections["all"].extend([websocket1, websocket2])

        message = {"type": "update", "data": "test"}
        await manager.broadcast(message)

        assert websocket1.send_json.called
        assert websocket2.send_json.called
        websocket1.send_json.assert_called_once_with(message)
        websocket2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast_to_line_and_all(self, manager):
        """Test broadcasting with line_id sends to both line and 'all'."""
        line_id = "line-123"
        ws_all = AsyncMock()
        ws_line = AsyncMock()
        manager.active_connections["all"].append(ws_all)
        manager.active_connections[line_id].append(ws_line)

        message = {"type": "update", "data": "test"}
        await manager.broadcast(message, line_id)

        assert ws_all.send_json.called
        assert ws_line.send_json.called

    @pytest.mark.asyncio
    async def test_broadcast_handles_send_error(self, manager):
        """Test broadcast handles send errors gracefully."""
        websocket = AsyncMock()
        websocket.send_json.side_effect = Exception("Send failed")
        manager.active_connections["all"].append(websocket)

        message = {"type": "update", "data": "test"}

        # Should not raise - error is caught
        await manager.broadcast(message)

        # The send was attempted
        assert websocket.send_json.called

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_channel(self, manager):
        """Test broadcasting to channel with no connections doesn't crash."""
        message = {"type": "update", "data": "test"}

        # Should not raise
        await manager.broadcast(message, "empty-line")

    @pytest.mark.asyncio
    async def test_multiple_connections_same_line(self, manager):
        """Test multiple connections to same line."""
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        line_id = "line-123"

        await manager.connect(ws1, line_id)
        await manager.connect(ws2, line_id)

        assert ws1 in manager.active_connections[line_id]
        assert ws2 in manager.active_connections[line_id]
        assert len(manager.active_connections[line_id]) == 2

    @pytest.mark.asyncio
    async def test_connect_then_disconnect(self, manager):
        """Test full connect/disconnect lifecycle."""
        websocket = AsyncMock()
        line_id = "line-123"

        await manager.connect(websocket, line_id)
        assert websocket in manager.active_connections[line_id]

        manager.disconnect(websocket, line_id)
        assert websocket not in manager.active_connections[line_id]

    def test_active_connections_initialization(self, manager):
        """Test manager initializes with empty connections dict."""
        assert isinstance(manager.active_connections, dict)
