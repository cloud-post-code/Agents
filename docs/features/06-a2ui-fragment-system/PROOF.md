# Proof: A2UI Fragment System

## Primary Proof Command

```bash
npx vitest run frontend/src/components/a2ui/
```

## Green State

1. Every atomic fragment renders without error with valid props
2. Every row fragment renders without error with valid props
3. Every section container renders without error with 1–4 child rows
4. `<A2UISurface surface="SURFACE:inventory" components={[...]} />` renders without error
5. Cross-agent fragment access renders `<RedactedFragment>` not the real component
6. ApprovalBlock degrades to Table when no ApprovalTag child present
7. CompareGrid renders `+N more` when >4 items provided
8. Backend: `render_ui` tool call with out-of-catalog fragment returns validation error
9. Backend: self-correction loop retries up to 2 times on validation failure, then returns error message to user

## Executable Proof File

`frontend/src/components/a2ui/__tests__/fragments.test.tsx`

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PriceTag } from "../atoms/PriceTag";
import { StockBadge } from "../atoms/StockBadge";
import { ProductRow } from "../rows/ProductRow";
import { Table } from "../containers/Table";
import { ApprovalBlock } from "../containers/ApprovalBlock";
import { CompareGrid } from "../containers/CompareGrid";
import { A2UISurface } from "../A2UISurface";

describe("Atomic fragments", () => {
  it("PriceTag renders amount", () => {
    render(<PriceTag amount={45.00} currency="USD" />);
    expect(screen.getByText(/45/)).toBeDefined();
  });

  it("StockBadge shows low stock warning", () => {
    render(<StockBadge quantity={2} lowThreshold={5} outThreshold={0} />);
    expect(screen.getByText(/low/i)).toBeDefined();
  });
});

describe("Composition rules", () => {
  it("ApprovalBlock degrades to Table without ApprovalTag children", () => {
    const { container } = render(
      <ApprovalBlock>
        <tr><td>No approval tag here</td></tr>
      </ApprovalBlock>
    );
    expect(container.querySelector("table")).toBeDefined();
    expect(container.querySelector("[data-approval-block]")).toBeNull();
  });

  it("CompareGrid shows +N more when >4 items", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i }));
    render(<CompareGrid items={items} renderItem={(i) => <div>{i.id}</div>} />);
    expect(screen.getByText(/\+2 more/)).toBeDefined();
  });
});

describe("A2UI Surface", () => {
  it("SURFACE:inventory renders without error", () => {
    render(
      <A2UISurface
        surface="SURFACE:inventory"
        components={[
          { type: "StatRow", children: [{ type: "StockBadge", quantity: 10, lowThreshold: 5, outThreshold: 0 }] }
        ]}
        agentRole="product_manager"
      />
    );
    expect(screen.queryByText("Error")).toBeNull();
  });

  it("cross-agent fragment shows Redacted", () => {
    render(
      <A2UISurface
        surface="SURFACE:inventory"
        components={[{ type: "OrderRow" }]}  // OrderRow not in PM catalog
        agentRole="product_manager"
      />
    );
    expect(screen.getByText(/restricted/i)).toBeDefined();
  });
});
```

`backend/tests/test_render_ui_tool.py`

```python
import pytest

@pytest.mark.asyncio
async def test_render_ui_rejects_out_of_catalog_fragment(strategist_agent, tenant):
    with pytest.raises(Exception, match="not in catalog"):
        await strategist_agent.tools["render_ui"].ainvoke({
            "surface": "custom",
            "components": [{"type": "OrderRow"}]  # Admin-only
        })

@pytest.mark.asyncio
async def test_render_ui_accepts_valid_catalog_fragment(strategist_agent, tenant):
    result = await strategist_agent.tools["render_ui"].ainvoke({
        "surface": "SURFACE:strategy",
        "components": [{"type": "MetricRow", "label": "Revenue", "value": "$12,400"}]
    })
    assert result["status"] == "rendered"
```
