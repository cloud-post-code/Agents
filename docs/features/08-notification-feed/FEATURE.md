# Feature: In-App Notification Feed

## What to Build

Real-time in-app notification system. Agents and system events push notifications; user sees them in a feed and a badge count.

### Notification Types

| Type | Trigger | Payload |
|---|---|---|
| `task_pending_approval` | Agent creates task | `{task_id, title, agent_role}` |
| `task_approved` | Human approves task | `{task_id, title}` |
| `task_rejected` | Human rejects task | `{task_id, title, reason}` |
| `report_ready` | Report generation complete | `{report_id, title, format, download_url}` |
| `agent_message` | Agent sends a message while user is on different page | `{session_id, agent_role, preview}` |
| `sync_error` | Facebook sync fails | `{integration_type, error_message}` |

### Backend

- `notifications` table row created for each event
- Redis pub/sub channel per tenant: `notifications:{tenant_id}`
- `GET /api/events/stream` — SSE endpoint; subscribes to Redis channel, streams events to browser
- `GET /api/v1/notifications` — paginated list; `?unread=true` filter
- `POST /api/v1/notifications/{id}/read` — marks single notification read
- `POST /api/v1/notifications/read-all` — marks all read

### Frontend

- SSE connection opened on app mount via `useNotifications()` hook
- Notification bell in top bar with unread badge count
- Clicking bell opens notification panel (slide-over)
- Notification panel: list of notifications, newest first, unread highlighted
- Each notification type has an icon and a click action:
  - `task_pending_approval` → navigate to `/tasks`
  - `report_ready` → navigate to `/reports/{report_id}`
  - `sync_error` → navigate to `/settings/integrations`
- Toast popup for new notifications arriving via SSE (3-second auto-dismiss)
- Unread count in browser tab title: `(3) Artisan Platform`
