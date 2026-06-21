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

  it("StockBadge shows out of stock", () => {
    render(<StockBadge quantity={0} lowThreshold={5} outThreshold={0} />);
    expect(screen.getByText(/out/i)).toBeDefined();
  });

  it("StockBadge shows in stock", () => {
    render(<StockBadge quantity={20} lowThreshold={5} outThreshold={0} />);
    expect(screen.getByText(/in stock/i)).toBeDefined();
  });
});

describe("Row fragments", () => {
  it("ProductRow renders name", () => {
    const { container } = render(
      <table><tbody><ProductRow name="Ceramic Bowl" sku="CB-001" price={45} stockQty={10} /></tbody></table>
    );
    expect(container.textContent).toContain("Ceramic Bowl");
  });
});

describe("Container fragments", () => {
  it("Table renders headers", () => {
    render(
      <Table headers={["Name", "Price"]}>
        <tr><td>Test</td><td>$10</td></tr>
      </Table>
    );
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Price")).toBeDefined();
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
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i, label: `Item ${i}` }));
    render(<CompareGrid items={items} renderItem={(item: any) => <div>{item.label}</div>} />);
    expect(screen.getByText(/\+2 more/)).toBeDefined();
  });

  it("CompareGrid renders max 4 items when 4 given", () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ id: i, label: `Item ${i}` }));
    const { container } = render(
      <CompareGrid items={items} renderItem={(item: any) => <div>{item.label}</div>} />
    );
    // No overflow row
    expect(screen.queryByText(/more/)).toBeNull();
  });
});

describe("A2UI Surface", () => {
  it("SURFACE:inventory renders without error", () => {
    render(
      <A2UISurface
        surface="SURFACE:inventory"
        components={[
          { type: "StatRow", label: "Total", value: "42", children: [{ type: "StockBadge", quantity: 10, lowThreshold: 5, outThreshold: 0 }] }
        ]}
        agentRole="product_manager"
      />
    );
    expect(screen.queryByText("Error")).toBeNull();
    expect(screen.getByText("Total")).toBeDefined();
  });

  it("cross-agent fragment shows Redacted", () => {
    render(
      <A2UISurface
        surface="SURFACE:inventory"
        components={[{ type: "OrderRow", orderId: "ORD-001" }]}
        agentRole="product_manager"  // OrderRow is NOT in PM catalog
      />
    );
    expect(screen.getByText(/restricted/i)).toBeDefined();
  });

  it("allowed fragment renders for correct agent", () => {
    render(
      <A2UISurface
        surface="SURFACE:orders"
        components={[{ type: "OrderRow", orderId: "ORD-001", status: "pending" }]}
        agentRole="admin"  // OrderRow IS in admin catalog
      />
    );
    expect(screen.queryByText(/restricted/i)).toBeNull();
    expect(screen.getByText("ORD-001")).toBeDefined();
  });
});
