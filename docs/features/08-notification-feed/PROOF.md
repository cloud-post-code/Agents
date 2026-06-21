# Proof: In-App Notification Feed

## Primary Proof Command

```bash
pytest backend/tests/test_notifications.py -v
```

## Green State

1. Creating a task writes a `task_pending_approval` notification row
2. SSE endpoint streams the notification to the connected client within 1 second
3. `GET /api/v1/notifications` returns notifications scoped to tenant
4. `POST /api/v1/notifications/{id}/read` marks it read; subsequent list shows `read_at` set
5. `POST /api/v1/notifications/read-all` marks all unread as read
6. Tenant B cannot read or mark Tenant A's notifications
7. Playwright: approve a task, see `task_approved` notification appear as toast within 2 seconds

## Executable Proof File

`backend/tests/test_notifications.py`

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_task_creation_writes_notification(client, auth_headers, db, pending_task):
    result = await db.execute(
        "SELECT type, payload FROM notifications WHERE payload->>'task_id' = :tid",
        {"tid": str(pending_task.id)}
    )
    row = result.fetchone()
    assert row is not None
    assert row[0] == "task_pending_approval"

@pytest.mark.asyncio
async def test_sse_delivers_notification(client, auth_headers, db):
    received = []
    async def listen():
        async with client.stream("GET", "/api/events/stream", headers=auth_headers) as r:
            async for line in r.aiter_lines():
                if line.startswith("data:"):
                    received.append(line)
                    break

    listener = asyncio.create_task(listen())
    await asyncio.sleep(0.1)
    # Trigger a notification
    await client.post("/api/v1/auth/test-notify", headers=auth_headers,
                     json={"type": "agent_message", "preview": "Hello"})
    await asyncio.wait_for(listener, timeout=3.0)
    assert len(received) > 0

@pytest.mark.asyncio
async def test_mark_read(client, auth_headers, unread_notification):
    r = await client.post(
        f"/api/v1/notifications/{unread_notification.id}/read",
        headers=auth_headers
    )
    assert r.status_code == 200
    r2 = await client.get("/api/v1/notifications?unread=true", headers=auth_headers)
    ids = [n["id"] for n in r2.json()["items"]]
    assert str(unread_notification.id) not in ids
```
