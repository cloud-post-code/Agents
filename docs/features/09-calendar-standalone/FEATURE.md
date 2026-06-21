# Feature: Standalone Calendar

## What to Build

A standalone calendar where agents and humans can create, view, and manage events. No external sync.

### Backend

- `GET /api/v1/calendar/events` — events for date range: `?start=ISO&end=ISO`
- `POST /api/v1/calendar/events` — create event (human-created; `created_by` is null)
- `PATCH /api/v1/calendar/events/{id}` — update event
- `DELETE /api/v1/calendar/events/{id}` — delete event
- Agents create events via the `create_calendar_event` shared tool (sets `created_by` to agent role)
- Events linked to tasks via `related_task_id` FK — approving a task with a due date auto-creates a calendar event

### Calendar Event Fields

- `title`, `description`, `starts_at`, `ends_at`, `all_day`
- `created_by` (agent_role or null for human)
- `related_task_id` (optional)
- Color coding by source: Strategist (blue), PM (green), Marketer (purple), Admin (orange), Human (grey)

### Frontend

- `/calendar` page: monthly/weekly/day view (default: monthly)
- Toggle between month, week, day views
- Events shown as colored chips on calendar cells
- Click event → detail slide-over: title, description, agent badge (if agent-created), linked task (if any)
- "Add Event" button: opens modal with title, date/time, description fields
- Agent-created events have an agent badge chip; human-created have no badge
- Events linked to tasks show a task status pill in the detail view
- Month navigation (previous/next/today)
