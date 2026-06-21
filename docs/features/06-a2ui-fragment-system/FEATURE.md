# Feature: A2UI Fragment System

## What to Build

The full fractional A2UI component system — all atomic fragments, row fragments, section containers, and named surface compositions wired into the agent chat pipeline.

### Backend

- Pydantic models for every fragment type (27 atoms, 15 rows, 8 containers, 8 surfaces)
- `render_ui` tool implementation: validates incoming component list against agent's catalog, rejects fragments outside catalog with `ToolError`
- WebSocket streaming of validated A2UI payloads: `{type: "a2ui", payload: {surface, components}}`
- Self-correction loop: on validation failure, sends error back to LLM, retries up to 2 times
- Catalog registry: `{agent_role: [allowed_fragment_ids]}` enforced at tool call time

### Frontend

- React component for every atomic fragment in `frontend/src/components/a2ui/atoms/`
- React component for every row fragment in `frontend/src/components/a2ui/rows/`
- React component for every section container in `frontend/src/components/a2ui/containers/`
- Named surface compositions in `frontend/src/components/a2ui/surfaces/`
- `<A2UISurface>` renderer: receives `{surface, components}` payload, assembles and renders the correct React tree
- CopilotKit `useFrontendTool("render_ui", ...)` hook mounts `<A2UISurface>` inline in chat
- Cross-agent fragment access: fragments outside the agent's catalog render as `<RedactedFragment label="[Data Restricted]" />`
- Storybook stories for every fragment (visual regression baseline)

### Composition Rules Enforced

1. Max nesting depth: 3 (Surface > Container > Row > Atom) — enforced in renderer
2. ApprovalBlock degrades to Table if no child row has ApprovalTag
3. CompareGrid requires 2–4 items; overflow renders `+N more`
4. TimelineList requires DateLabel on every child row; falls back to Table
5. Named surface shorthand: agent can pass `"surface": "SURFACE:inventory"` and backend expands to canonical composition

## Catalog Per Agent (enforced at backend)

| Agent | Allowed Fragment IDs |
|---|---|
| strategist | PriceTag, CurrencyAmount, PercentChange, MarginPill, RevenueBar, TrendArrow, StockBadge (read), StatusPill, DateLabel, SeasonTag, QuantityCount, ConversionRate, ScoreBadge, UnitsSold, ChannelBadge, CustomerTier, MetricRow, ForecastRow, CompetitorRow, ChannelRow, Table, GroupedTable, StatRow, CompareGrid, SummaryPanel, CardGrid, SURFACE:strategy, SURFACE:financials |
| product_manager | PriceTag, CurrencyAmount, MarginPill, CostBreakdown, StockBadge, StatusPill, PriorityFlag, DueBadge, LeadTimePill, DateLabel, SeasonTag, QuantityCount, ScoreBadge, SupplierTag, AgentBadge, ProductRow, VariantRow, MaterialRow, SupplierRow, TaskRow, ForecastRow, Table, GroupedTable, StatRow, TimelineList, SummaryPanel, SURFACE:inventory, SURFACE:suppliers |
| marketer | PriceTag, CurrencyAmount, PercentChange, TrendArrow, StatusPill, RatingStars, ConversionRate, ScoreBadge, UnitsSold, ChannelBadge, CustomerTier, DateLabel, SeasonTag, AgentBadge, ListingRow, ChannelRow, CampaignRow, Table, CardGrid, StatRow, TimelineList, CompareGrid, SummaryPanel, SURFACE:channels, SURFACE:campaigns |
| admin | CurrencyAmount, StatusPill, ApprovalTag, FulfillmentDot, PriorityFlag, DelayWarning, AvatarChip, AgentBadge, DateLabel, DueBadge, QuantityCount, OrderRow, LineItemRow, ReturnRow, TaskRow, ExpenseRow, Table, GroupedTable, ApprovalBlock, TimelineList, StatRow, SummaryPanel, SURFACE:orders, SURFACE:tasks |

## Out of Scope

- Real data population of fragments (fragments receive data from agent tool calls, not this feature's scope)
- Storybook CI integration (manual review only in this feature)
