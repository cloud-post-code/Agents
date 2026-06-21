"""Feature 07: Task Queue + Approval Flow proof tests."""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import text


@pytest.fixture
async def pending_task_data(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a task via API and return the task data."""
    r = await client.post("/api/v1/tasks/test-create", json={})
    # Instead we insert directly via the task creation endpoint workaround
    # Actually we need a direct task create endpoint or use DB
    pass


@pytest.mark.asyncio
async def test_create_and_list_tasks(client: AsyncClient, auth_headers: dict, db):
    """Create a task directly in DB and verify list endpoint returns it."""
    from sqlalchemy import text
    import uuid

    # Get the tenant_id from current user by calling /me
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    task_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority) "
            "VALUES (:id, :tid, 'Update shipping rates', 'pending', 0)"
        ),
        {"id": task_id, "tid": tenant_id},
    )
    await db.commit()

    # List tasks (RLS will scope to tenant via auth headers)
    r = await client.get("/api/v1/tasks", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "tasks" in body
    task_ids = [t["id"] for t in body["tasks"]]
    assert task_id in task_ids


@pytest.mark.asyncio
async def test_approve_task(client: AsyncClient, auth_headers: dict, db):
    """Approve a pending task and verify status updates."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    task_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority) "
            "VALUES (:id, :tid, 'Task to approve', 'pending', 0)"
        ),
        {"id": task_id, "tid": tenant_id},
    )
    await db.commit()

    # Approve
    r = await client.post(f"/api/v1/tasks/{task_id}/approve", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved"
    assert len(body["approvals"]) == 1
    assert body["approvals"][0]["action"] == "approved"


@pytest.mark.asyncio
async def test_reject_task_with_reason(client: AsyncClient, auth_headers: dict, db):
    """Reject a task with a reason and verify."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    task_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority) "
            "VALUES (:id, :tid, 'Task to reject', 'pending', 0)"
        ),
        {"id": task_id, "tid": tenant_id},
    )
    await db.commit()

    r = await client.post(
        f"/api/v1/tasks/{task_id}/reject",
        json={"reason": "Not the right time"},
        headers=auth_headers,
    )
    assert r.status_code == 200

    # Get task detail
    r2 = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert r2.status_code == 200
    body = r2.json()
    assert body["status"] == "rejected"
    assert body["approvals"][0]["reason"] == "Not the right time"


@pytest.mark.asyncio
async def test_get_task_not_found(client: AsyncClient, auth_headers: dict):
    """Non-existent task returns 404."""
    fake_id = str(uuid.uuid4())
    r = await client.get(f"/api/v1/tasks/{fake_id}", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cross_tenant_task_isolation(client: AsyncClient, auth_headers: dict, auth_headers_b: dict, db):
    """Tenant B cannot approve Tenant A's task (RLS blocks it → 404)."""
    # Get tenant A's tenant_id
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_a_id = me_r.json()["tenant"]["id"]

    # Create task for tenant A
    task_id = str(uuid.uuid4())
    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority) "
            "VALUES (:id, :tid, 'Tenant A task', 'pending', 0)"
        ),
        {"id": task_id, "tid": tenant_a_id},
    )
    await db.commit()

    # Tenant B tries to approve tenant A's task — should get 404 (RLS blocks it)
    r = await client.post(f"/api/v1/tasks/{task_id}/approve", headers=auth_headers_b)
    assert r.status_code == 404, f"Expected 404 but got {r.status_code}: {r.text}"


@pytest.mark.asyncio
async def test_filter_tasks_by_status(client: AsyncClient, auth_headers: dict, db):
    """Filter tasks by status returns only matching tasks."""
    me_r = await client.get("/api/v1/auth/me", headers=auth_headers)
    tenant_id = me_r.json()["tenant"]["id"]

    pending_id = str(uuid.uuid4())
    approved_id = str(uuid.uuid4())

    await db.execute(
        text(
            "INSERT INTO tasks (id, tenant_id, title, status, priority) VALUES "
            "(:pid, :tid, 'Pending task', 'pending', 0), "
            "(:aid, :tid, 'Approved task', 'approved', 0)"
        ),
        {"pid": pending_id, "aid": approved_id, "tid": tenant_id},
    )
    await db.commit()

    r = await client.get("/api/v1/tasks?status=pending", headers=auth_headers)
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()["tasks"]]
    assert pending_id in ids
    assert approved_id not in ids
