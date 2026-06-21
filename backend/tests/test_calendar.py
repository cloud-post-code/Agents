"""Feature 09: Standalone Calendar proof tests."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import text


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


NOW = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
TOMORROW = NOW + timedelta(days=1)
NEXT_WEEK = NOW + timedelta(days=7)


@pytest.mark.asyncio
async def test_create_and_list_event(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "Price review",
        "starts_at": iso(TOMORROW),
        "all_day": True,
    })
    assert r.status_code == 201
    event_id = r.json()["id"]

    r2 = await client.get(
        f"/api/v1/calendar/events?start={iso(NOW)}&end={iso(NEXT_WEEK)}",
        headers=auth_headers,
    )
    assert r2.status_code == 200
    ids = [e["id"] for e in r2.json()["events"]]
    assert event_id in ids


@pytest.mark.asyncio
async def test_list_excludes_out_of_range(client: AsyncClient, auth_headers: dict):
    far_future = NOW + timedelta(days=30)
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "Far future event",
        "starts_at": iso(far_future),
    })
    event_id = r.json()["id"]

    r2 = await client.get(
        f"/api/v1/calendar/events?start={iso(NOW)}&end={iso(NEXT_WEEK)}",
        headers=auth_headers,
    )
    ids = [e["id"] for e in r2.json()["events"]]
    assert event_id not in ids


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "Old title",
        "starts_at": iso(TOMORROW),
    })
    event_id = r.json()["id"]

    r2 = await client.patch(
        f"/api/v1/calendar/events/{event_id}",
        headers=auth_headers,
        json={"title": "Updated title"},
    )
    assert r2.status_code == 200
    assert r2.json()["title"] == "Updated title"


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "To delete",
        "starts_at": iso(TOMORROW),
    })
    event_id = r.json()["id"]

    r2 = await client.delete(f"/api/v1/calendar/events/{event_id}", headers=auth_headers)
    assert r2.status_code == 204

    r3 = await client.get(
        f"/api/v1/calendar/events?start={iso(NOW)}&end={iso(NEXT_WEEK)}",
        headers=auth_headers,
    )
    ids = [e["id"] for e in r3.json()["events"]]
    assert event_id not in ids


@pytest.mark.asyncio
async def test_task_approval_creates_calendar_event(
    client: AsyncClient, auth_headers: dict, db
):
    """Approving a task with due_at auto-creates a calendar event."""
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me.json()["tenant"]["id"]

    task_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority, due_at) "
            "VALUES (:id, :tid, 'Ship update', 'pending', 3, :due)"
        ),
        {"id": task_id, "tid": tenant_id, "due": TOMORROW},
    )
    await db.commit()

    r = await client.post(f"/api/v1/tasks/{task_id}/approve", headers=auth_headers)
    assert r.status_code == 200

    result = await db.execute(
        text("SELECT id FROM calendar_events WHERE related_task_id = :tid"),
        {"tid": task_id},
    )
    assert result.fetchone() is not None


@pytest.mark.asyncio
async def test_calendar_tenant_isolation(
    client: AsyncClient, auth_headers: dict, auth_headers_b: dict
):
    r = await client.post("/api/v1/calendar/events", headers=auth_headers, json={
        "title": "Tenant A event",
        "starts_at": iso(TOMORROW),
    })
    event_id = r.json()["id"]

    r2 = await client.get(
        f"/api/v1/calendar/events?start={iso(NOW)}&end={iso(NEXT_WEEK)}",
        headers=auth_headers_b,
    )
    ids = [e["id"] for e in r2.json()["events"]]
    assert event_id not in ids
