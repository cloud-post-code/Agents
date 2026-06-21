# Feature: Task Queue + Approval Flow

## What to Build

Agents create tasks that require human approval before execution. The human reviews and approves/rejects in the task queue UI. LangGraph graph resumes after approval.

### Backend

- `create_task` tool implementation: inserts task row with `status='pending'`, suspends LangGraph graph at interrupt node, returns `{task_id, message: "Task created, awaiting your approval"}`
- `POST /api/v1/tasks/{task_id}/approve` — updates status to `approved`, creates `task_approvals` row, resumes LangGraph graph from checkpoint
- `POST /api/v1/tasks/{task_id}/reject` — updates status to `rejected`, creates `task_approvals` row with reason
- `GET /api/v1/tasks` — paginated list; filterable by `status`, `created_by` (agent role), `assigned_to`
- `GET /api/v1/tasks/{task_id}` — task detail with approval history
- Celery task: after approval, if task has `celery_task_id`, enqueues the execution job
- SSE event pushed on task creation: `{type: "task_pending_approval", task_id, title, created_by}`

### Task Status State Machine

```
draft → pending → approved → in_progress → completed
                           ↘ failed
              ↘ rejected
```

### Frontend

- `/tasks` page: list of all tasks grouped by status (pending first, then approved, in_progress, completed/rejected)
- Each task card shows: title, description, which agent created it, priority flag, due date badge, status pill
- Pending tasks have `Approve` and `Reject` buttons; reject opens a reason input dialog
- Rejected tasks show the rejection reason
- Completed tasks show output summary if available
- Filter bar: by agent, by status, by date range
- When a task is approved, the chat that created it shows "Task approved — resuming..." and the agent continues

### Task Cards use A2UI TaskRow

Each task in the list renders using the `TaskRow` fragment: `[PriorityFlag] [TaskName] [AgentBadge] [DueBadge] [StatusPill]`

## Out of Scope

- Automated task execution (agents run tasks themselves without human oversight) — v2
- Task assignment to human team members — v2
- Task templates — v2
