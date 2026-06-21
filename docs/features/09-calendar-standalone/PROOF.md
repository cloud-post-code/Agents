# Proof: Standalone Calendar

## Primary Proof Command

```bash
pytest backend/tests/test_calendar.py -v
```

## Green State

1. `POST /api/v1/calendar/events` creates an event scoped to tenant
2. `GET /api/v1/calendar/events?start=...&end=...` returns only events in range, scoped to tenant
3. `PATCH` updates event; `DELETE` removes it
4. Agent-created event has `created_by` set to agent role
5. Approving a task with `due_at` auto-creates a calendar event linked via `related_task_id`
6. Tenant B cannot read Tenant A's calendar events
7. Playwright: navigate to `/calendar`, add an event, see it appear on the correct date

## Executable Proof File

`backend/tests/test_calendar.py`

```python
import pytest
from datetime import datetime, timedelta, timezone

@pytest.mark.asyncio
async def test_create_and_list_event(client, auth_headers):
    starts = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "Price review",
        "starts_at": starts,
        "all_day": True
    })
    assert r.status_code == 201
    event_id = r.json()["id"]

    start_range = datetime.now(timezone.utc).isoformat()
    end_range = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r2 = await client.get(
        f"/api/v1/calendar/events?start={start_range}&end={end_range}",
        headers=auth_headers
    )
    ids = [e["id"] for e in r2.json()["events"]]
    assert event_id in ids

@pytest.mark.asyncio
async def test_task_approval_creates_calendar_event(client, auth_headers, pending_task_with_due_date, db):
    await client.post(
        f"/api/v1/tasks/{pending_task_with_due_date.id}/approve",
        headers=auth_headers
    )
    result = await db.execute(
        "SELECT id FROM calendar_events WHERE related_task_id = :tid",
        {"tid": str(pending_task_with_due_date.id)}
    )
    assert result.fetchone() is not None

@pytest.mark.asyncio
async def test_calendar_tenant_isolation(client, auth_headers_b, event_tenant_a):
    r = await client.get(
        "/api/v1/calendar/events?start=2020-01-01T00:00:00Z&end=2030-01-01T00:00:00Z",
        headers=auth_headers_b
    )
    ids = [e["id"] for e in r.json()["events"]]
    assert str(event_tenant_a.id) not in ids
```
