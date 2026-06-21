# Feature: Agent Chat Core

## What to Build

Real streaming agent chat for all 4 agents using LangGraph + CopilotKit. No A2UI surfaces yet — text responses only, with tool call scaffolding in place.

### Backend

- `BaseArtisanAgent` class: LangGraph graph with call_model → tools → call_model loop
- LangGraph PostgreSQL checkpointer for session persistence (human-in-the-loop foundation)
- WebSocket endpoint: `GET /ws/agent/{role}/chat?session_id={uuid}`
  - Streams `{type: "token", content: "..."}` for text
  - Streams `{type: "session_id", value: "..."}` on first message (new session)
  - Accepts `{type: "message", content: "..."}` from client
- All 4 agent subclasses with correct system prompts and tool stubs
- Shared tools stubbed (return mock data): `create_task`, `render_ui`, `generate_report`, `search_catalog`
- Role-specific tools stubbed: each agent has its tool functions wired but returning placeholder responses
- `agent_sessions` and `agent_messages` rows written for every turn

### Agent System Prompts

Each agent has a system prompt that:
1. Defines their role and domain
2. Lists their available tools
3. Lists their A2UI component catalog (for future use)
4. States the constraint: create a task before modifying data; offer a report for complex queries

### Frontend

- CopilotKit `<CopilotChat>` wired to the backend WebSocket (`/ws/agent/{role}/chat`)
- Token streaming renders progressively in chat bubble
- Session ID persisted in URL (`?session={uuid}`) so refreshing continues the same session
- Chat history loaded from `GET /api/v1/agents/{role}/sessions/{session_id}/messages` on mount
- "New conversation" button starts fresh session

## Out of Scope

- Real tool implementations (those come per-feature)
- A2UI surface rendering (feature 06)
- Task approval interrupt (feature 07)
- Market data integrations
