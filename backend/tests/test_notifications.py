"""Feature 08: In-App Notification Feed proof tests."""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text


@pytest.mark.asyncio
async def test_create_notification_and_list(client: AsyncClient, auth_headers: dict, db):
    """Create a notification and verify it appears in the list."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    notif_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO notifications (id, tenant_id, type, payload) "
            "VALUES (:id, :tid, 'task_pending_approval', :payload)"
        ),
        {
            "id": notif_id,
            "tid": tenant_id,
            "payload": '{"task_id": "abc123", "title": "Test task", "agent_role": "admin"}',
        },
    )
    await db.commit()

    r = await client.get("/api/v1/notifications", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    ids = [n["id"] for n in body["items"]]
    assert notif_id in ids


@pytest.mark.asyncio
async def test_list_unread_only(client: AsyncClient, auth_headers: dict, db):
    """Unread filter returns only unread notifications."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    unread_id = str(uuid.uuid4())
    read_id = str(uuid.uuid4())

    await db.execute(
        text(
            "INSERT INTO notifications (id, tenant_id, type, payload) VALUES "
            "(:uid, :tid, 'agent_message', '{}'), "
            "(:rid, :tid, 'report_ready', '{}')"
        ),
        {"uid": unread_id, "rid": read_id, "tid": tenant_id},
    )
    await db.commit()

    # Mark one as read
    await db.execute(
        text("UPDATE notifications SET read_at = now() WHERE id = :id"),
        {"id": read_id},
    )
    await db.commit()

    r = await client.get("/api/v1/notifications?unread=true", headers=auth_headers)
    assert r.status_code == 200
    ids = [n["id"] for n in r.json()["items"]]
    assert unread_id in ids
    assert read_id not in ids


@pytest.mark.asyncio
async def test_mark_notification_read(client: AsyncClient, auth_headers: dict, db):
    """Mark a notification as read."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    notif_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO notifications (id, tenant_id, type, payload) "
            "VALUES (:id, :tid, 'agent_message', '{}')"
        ),
        {"id": notif_id, "tid": tenant_id},
    )
    await db.commit()

    # Mark read
    r = await client.post(f"/api/v1/notifications/{notif_id}/read", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["read_at"] is not None

    # Verify it no longer shows in unread
    r2 = await client.get("/api/v1/notifications?unread=true", headers=auth_headers)
    ids = [n["id"] for n in r2.json()["items"]]
    assert notif_id not in ids


@pytest.mark.asyncio
async def test_mark_all_read(client: AsyncClient, auth_headers: dict, db):
    """Mark all notifications as read."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    for _ in range(3):
        nid = str(uuid.uuid4())
        await db.execute(
            text(
                "INSERT INTO notifications (id, tenant_id, type, payload) "
                "VALUES (:id, :tid, 'agent_message', '{}')"
            ),
            {"id": nid, "tid": tenant_id},
        )
    await db.commit()

    r = await client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["marked_read"] >= 3

    # All should now be read
    r2 = await client.get("/api/v1/notifications?unread=true", headers=auth_headers)
    assert len(r2.json()["items"]) == 0


@pytest.mark.asyncio
async def test_cross_tenant_notification_isolation(
    client: AsyncClient, auth_headers: dict, auth_headers_b: dict, db
):
    """Tenant B cannot read Tenant A's notifications."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_a_id = me_r.json()["tenant"]["id"]

    notif_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO notifications (id, tenant_id, type, payload) "
            "VALUES (:id, :tid, 'agent_message', '{}')"
        ),
        {"id": notif_id, "tid": tenant_a_id},
    )
    await db.commit()

    # Tenant B should not see tenant A's notification
    r = await client.get("/api/v1/notifications", headers=auth_headers_b)
    assert r.status_code == 200
    ids = [n["id"] for n in r.json()["items"]]
    assert notif_id not in ids

    # Tenant B should not be able to mark it read (should get 404)
    r2 = await client.post(f"/api/v1/notifications/{notif_id}/read", headers=auth_headers_b)
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_sse_endpoint_requires_auth(client: AsyncClient):
    """SSE endpoint rejects unauthenticated requests."""
    r = await client.get("/api/events/stream")
    assert r.status_code == 401
