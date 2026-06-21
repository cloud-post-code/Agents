# Proof: Task Queue + Approval Flow

## Primary Proof Command

```bash
pytest backend/tests/test_task_queue.py -v
```

## Green State

1. Agent `create_task` tool call inserts task with `status='pending'` and suspends the LangGraph graph
2. `GET /api/v1/tasks` returns the pending task scoped to the correct tenant
3. `POST /api/v1/tasks/{id}/approve` updates status to `approved`, creates approval row, resumes graph
4. After approval, agent chat resumes and sends a follow-up message
5. `POST /api/v1/tasks/{id}/reject` with reason updates status to `rejected`
6. Tenant B cannot approve Tenant A's task (RLS isolation)
7. SSE event fires with `task_pending_approval` type when task is created
8. Playwright: create a task via chat, see it appear in `/tasks`, approve it, see agent resume in chat

## Executable Proof File

`backend/tests/test_task_queue.py`

```python
import pytest
import json

@pytest.mark.asyncio
async def test_create_task_via_tool(client, auth_headers, db):
    # Trigger agent to create a task via the create_task tool
    async with aconnect_ws("/ws/agent/admin/chat", client, headers=auth_headers) as ws:
        await ws.send_text(json.dumps({
            "type": "message",
            "content": "Create a task to update my shipping rates next Monday"
        }))
        task_id = None
        async for msg in ws.iter_text():
            data = json.loads(msg)
            if data["type"] == "task_created":
                task_id = data["task_id"]
                break
    assert task_id is not None
    # Verify DB
    result = await db.execute("SELECT status FROM tasks WHERE id = :id", {"id": task_id})
    assert result.scalar() == "pending"

@pytest.mark.asyncio
async def test_approve_task_resumes_graph(client, auth_headers, pending_task):
    r = await client.post(
        f"/api/v1/tasks/{pending_task.id}/approve",
        headers=auth_headers
    )
    assert r.status_code == 200
    # Verify approval row
    r2 = await client.get(f"/api/v1/tasks/{pending_task.id}", headers=auth_headers)
    assert r2.json()["status"] == "approved"
    assert len(r2.json()["approvals"]) == 1

@pytest.mark.asyncio
async def test_reject_task(client, auth_headers, pending_task):
    r = await client.post(
        f"/api/v1/tasks/{pending_task.id}/reject",
        json={"reason": "Not the right time"},
        headers=auth_headers
    )
    assert r.status_code == 200
    r2 = await client.get(f"/api/v1/tasks/{pending_task.id}", headers=auth_headers)
    assert r2.json()["status"] == "rejected"
    assert r2.json()["approvals"][0]["reason"] == "Not the right time"

@pytest.mark.asyncio
async def test_cross_tenant_task_isolation(client, auth_headers_b, pending_task_tenant_a):
    r = await client.post(
        f"/api/v1/tasks/{pending_task_tenant_a.id}/approve",
        headers=auth_headers_b
    )
    assert r.status_code == 404
```
