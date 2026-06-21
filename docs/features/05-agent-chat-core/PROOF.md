# Proof: Agent Chat Core

## Primary Proof Command

```bash
pytest backend/tests/test_agent_chat.py -v
```

## Green State

1. WebSocket connection to `/ws/agent/strategist/chat` succeeds with valid JWT
2. Sending a message returns streaming token chunks followed by connection remaining open
3. All 4 agent roles accept WebSocket connections
4. Each turn writes rows to `agent_sessions` and `agent_messages`
5. Reconnecting with `session_id` loads prior message history
6. Invalid role returns 404; unauthenticated WebSocket returns 401
7. Playwright: type a message in the Strategist chat, see a streaming text response appear

## Executable Proof File

`backend/tests/test_agent_chat.py`

```python
import pytest
import json
from httpx_ws import aconnect_ws

@pytest.mark.asyncio
async def test_strategist_chat_streams_tokens(client, auth_headers):
    async with aconnect_ws(
        "/ws/agent/strategist/chat",
        client,
        headers=auth_headers
    ) as ws:
        await ws.send_text(json.dumps({"type": "message", "content": "Hello"}))
        chunks = []
        async for msg in ws.iter_text():
            data = json.loads(msg)
            if data["type"] == "token":
                chunks.append(data["content"])
            if data["type"] == "done":
                break
        assert len(chunks) > 0

@pytest.mark.asyncio
async def test_all_roles_accept_connections(client, auth_headers):
    for role in ["strategist", "product_manager", "marketer", "admin"]:
        async with aconnect_ws(
            f"/ws/agent/{role}/chat",
            client,
            headers=auth_headers
        ) as ws:
            assert ws is not None

@pytest.mark.asyncio
async def test_chat_persists_messages(client, auth_headers, db):
    async with aconnect_ws(
        "/ws/agent/strategist/chat",
        client,
        headers=auth_headers
    ) as ws:
        await ws.send_text(json.dumps({"type": "message", "content": "Test persistence"}))
        session_id = None
        async for msg in ws.iter_text():
            data = json.loads(msg)
            if data["type"] == "session_id":
                session_id = data["value"]
            if data["type"] == "done":
                break
    assert session_id is not None
    # Verify messages persisted
    result = await db.execute(
        "SELECT COUNT(*) FROM agent_messages WHERE session_id = :sid",
        {"sid": session_id}
    )
    assert result.scalar() >= 2  # user message + assistant response
```
