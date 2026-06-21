# Feature: Frontend Skeleton

## What to Build

Next.js 15 App Router frontend bootstrapped with routing, auth state, layout, and the 4 agent chat shells — no real agent logic yet, just working navigation and auth flows.

### Skill

`coding-frontend`

### Pages / Routes

```
/                          → redirect to /dashboard if authed, /login if not
/login                     → login form
/register                  → register form + onboarding wizard (step 1: business profile)
/dashboard                 → overview: notification feed, quick links to each agent
/agents/strategist         → Strategist chat shell (placeholder stream)
/agents/product-manager    → Product Manager chat shell
/agents/marketer           → Marketer chat shell
/agents/admin              → Admin chat shell
/tasks                     → Task queue page (empty state)
/calendar                  → Calendar page (empty state)
/reports                   → Report archive (empty state)
/notifications             → Notification feed (empty state)
```

### Layout

- Sidebar: logo, agent nav (4 items with icon + description), Tasks, Calendar, Reports, Notifications
- Each agent nav item shows agent name + one-line description
- Top bar: tenant business name, notification bell badge, user menu
- Mobile: sidebar collapses to bottom tab bar

### Auth State

- JWT stored in `httpOnly` cookie (set by Next.js API route, not localStorage)
- `useAuth()` hook wraps session state
- Middleware (`middleware.ts`) redirects unauthenticated users to `/login`
- Onboarding wizard shown after first registration (`onboarding: true` in JWT response)

### Agent Chat Shell

Each agent page renders:
- Agent header: name, avatar/icon, one-line description
- CopilotKit `<CopilotChat>` component wired to backend WebSocket endpoint
- Empty state when no messages: "Ask me anything about your [role domain]"
- No real agent responses yet — placeholder "thinking..." response to verify wiring

### Styling

- Tailwind CSS
- shadcn/ui for base components (Button, Input, Card, Badge, Sheet for mobile sidebar)
- No custom design system yet — functional layout only in this feature

## Out of Scope

- Real agent streaming (feature 05)
- A2UI surfaces (feature 06)
- Task approval UI (feature 07)
- Real notifications (feature 08)
- Calendar events (feature 09)
- Inventory pages (feature 10)
