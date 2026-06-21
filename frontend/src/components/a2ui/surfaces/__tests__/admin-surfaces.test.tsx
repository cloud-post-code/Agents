/**
 * Feature 16: Admin Agent A2UI Surface Components
 *
 * Tests cover:
 *  - InvoiceCard renders order id, customer, status, line items, total
 *  - BusinessProfileCard renders business name, entity type, address, contact
 *  - ShippingPolicyCard renders policy text and shipping config
 *  - OrdersTable renders list of orders with status and total
 *  - RevenueSummaryCard renders KPI stat rows
 *  - Non-admin fragment is redacted when rendered through A2UISurface with agentRole="admin"
 *  - A2UISurface with agentRole="admin" renders InvoiceCard without crash
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// These imports will fail (red) until the surface files are created
import { InvoiceCard } from "../InvoiceCard";
import { BusinessProfileCard } from "../BusinessProfileCard";
import { ShippingPolicyCard } from "../ShippingPolicyCard";
import { OrdersTable } from "../OrdersTable";
import { RevenueSummaryCard } from "../RevenueSummaryCard";
import { A2UISurface } from "../../A2UISurface";

// ---------------------------------------------------------------------------
// InvoiceCard
// ---------------------------------------------------------------------------

describe("InvoiceCard", () => {
  it("renders order id", () => {
    render(
      <InvoiceCard
        orderId="ORD-001"
        customerName="Jane Smith"
        status="pending"
        createdAt="2024-06-15"
        lineItems={[]}
        totalCents={0}
      />
    );
    expect(screen.getByText(/ORD-001/)).toBeDefined();
  });

  it("renders customer name", () => {
    render(
      <InvoiceCard
        orderId="ORD-002"
        customerName="Alice Maker"
        status="completed"
        createdAt="2024-06-10"
        lineItems={[{ description: "Bowl", quantity: 1, unitPriceCents: 4500 }]}
        totalCents={4500}
      />
    );
    expect(screen.getByText(/Alice Maker/)).toBeDefined();
  });

  it("renders status pill for 'shipped'", () => {
    render(
      <InvoiceCard
        orderId="ORD-003"
        customerName="Bob"
        status="shipped"
        createdAt="2024-05-01"
        lineItems={[]}
        totalCents={0}
      />
    );
    expect(screen.getByText(/shipped/i)).toBeDefined();
  });

  it("renders line item description", () => {
    render(
      <InvoiceCard
        orderId="ORD-004"
        customerName="Carol"
        status="pending"
        createdAt="2024-06-20"
        lineItems={[
          { description: "Ceramic Mug", quantity: 2, unitPriceCents: 1800 },
        ]}
        totalCents={3600}
      />
    );
    expect(screen.getByText(/Ceramic Mug/)).toBeDefined();
  });

  it("renders formatted total", () => {
    render(
      <InvoiceCard
        orderId="ORD-005"
        customerName="Dave"
        status="completed"
        createdAt="2024-06-01"
        lineItems={[]}
        totalCents={9900}
      />
    );
    // 9900 cents = $99.00
    expect(screen.getByText(/99/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BusinessProfileCard
// ---------------------------------------------------------------------------

describe("BusinessProfileCard", () => {
  const profile = {
    businessName: "Clay & Co.",
    shopDescription: "Handmade ceramics from Portland",
    entityType: "llc" as const,
    addressLine1: "456 Craft Ave",
    city: "Portland",
    state: "OR",
    postalCode: "97201",
    country: "US",
    contactEmail: "hello@clay.co",
    contactPhone: "503-555-0101",
    website: "https://clay.co",
  };

  it("renders business name", () => {
    render(<BusinessProfileCard {...profile} />);
    expect(screen.getByText(/Clay & Co\./)).toBeDefined();
  });

  it("renders entity type", () => {
    render(<BusinessProfileCard {...profile} />);
    expect(screen.getByText(/llc/i)).toBeDefined();
  });

  it("renders address line", () => {
    render(<BusinessProfileCard {...profile} />);
    expect(screen.getByText(/456 Craft Ave/)).toBeDefined();
  });

  it("renders contact email", () => {
    render(<BusinessProfileCard {...profile} />);
    expect(screen.getByText(/hello@clay\.co/)).toBeDefined();
  });

  it("renders website", () => {
    render(<BusinessProfileCard {...profile} />);
    expect(screen.getByText(/clay\.co/)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ShippingPolicyCard
// ---------------------------------------------------------------------------

describe("ShippingPolicyCard", () => {
  it("renders shipping policy text", () => {
    render(
      <ShippingPolicyCard
        shippingPolicy="Ships within 3 business days."
        cancellationPolicy="No cancellations after 24 hours."
        shippingFlatRateCents={500}
        shippingFreeThresholdCents={5000}
      />
    );
    expect(screen.getByText(/Ships within 3 business days/)).toBeDefined();
  });

  it("renders cancellation policy text", () => {
    render(
      <ShippingPolicyCard
        shippingPolicy="Fast shipping."
        cancellationPolicy="No cancellations after 24 hours."
      />
    );
    expect(screen.getByText(/No cancellations after 24 hours/)).toBeDefined();
  });

  it("renders flat rate when provided", () => {
    render(
      <ShippingPolicyCard
        shippingPolicy="Standard shipping."
        cancellationPolicy="Flexible."
        shippingFlatRateCents={799}
      />
    );
    // 799 cents = $7.99
    expect(screen.getByText(/7/)).toBeDefined();
  });

  it("renders without crash when optional props omitted", () => {
    const { container } = render(
      <ShippingPolicyCard shippingPolicy="" cancellationPolicy="" />
    );
    expect(container).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OrdersTable
// ---------------------------------------------------------------------------

describe("OrdersTable", () => {
  const orders = [
    { orderId: "ORD-A", customerName: "Anna", status: "pending", totalCents: 3000, createdAt: "2024-06-01" },
    { orderId: "ORD-B", customerName: "Ben", status: "shipped", totalCents: 1500, createdAt: "2024-06-05" },
  ];

  it("renders all order ids", () => {
    render(<OrdersTable orders={orders} />);
    expect(screen.getByText(/ORD-A/)).toBeDefined();
    expect(screen.getByText(/ORD-B/)).toBeDefined();
  });

  it("renders customer names", () => {
    render(<OrdersTable orders={orders} />);
    expect(screen.getByText(/Anna/)).toBeDefined();
    expect(screen.getByText(/Ben/)).toBeDefined();
  });

  it("renders status pills", () => {
    render(<OrdersTable orders={orders} />);
    expect(screen.getByText(/pending/i)).toBeDefined();
    expect(screen.getByText(/shipped/i)).toBeDefined();
  });

  it("renders empty state when no orders", () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByText(/no orders/i)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// RevenueSummaryCard
// ---------------------------------------------------------------------------

describe("RevenueSummaryCard", () => {
  it("renders total orders count", () => {
    render(
      <RevenueSummaryCard
        totalOrders={12}
        totalRevenueCents={108000}
        avgOrderValueCents={9000}
        periodStart="2024-06-01"
        periodEnd="2024-06-30"
      />
    );
    expect(screen.getByText(/12/)).toBeDefined();
  });

  it("renders total revenue formatted", () => {
    render(
      <RevenueSummaryCard
        totalOrders={5}
        totalRevenueCents={50000}
        avgOrderValueCents={10000}
        periodStart="2024-06-01"
        periodEnd="2024-06-30"
      />
    );
    // $500.00
    expect(screen.getByText(/500/)).toBeDefined();
  });

  it("renders zero state without crash", () => {
    const { container } = render(
      <RevenueSummaryCard
        totalOrders={0}
        totalRevenueCents={0}
        avgOrderValueCents={0}
        periodStart="2024-06-01"
        periodEnd="2024-06-30"
      />
    );
    expect(container).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// A2UISurface integration — admin agent can render admin surfaces
// ---------------------------------------------------------------------------

describe("A2UISurface with admin surfaces", () => {
  it("renders InvoiceCard surface for admin agent without crash", () => {
    render(
      <A2UISurface
        surface="SURFACE:orders"
        components={[
          {
            type: "InvoiceCard",
            orderId: "ORD-SURF-001",
            customerName: "Surface Test",
            status: "pending",
            createdAt: "2024-06-15",
            lineItems: [],
            totalCents: 0,
          },
        ]}
        agentRole="admin"
      />
    );
    expect(screen.queryByText("Error")).toBeNull();
    expect(screen.getByText(/ORD-SURF-001/)).toBeDefined();
  });

  it("renders RevenueSummaryCard surface for admin agent", () => {
    render(
      <A2UISurface
        surface="SURFACE:financials"
        components={[
          {
            type: "RevenueSummaryCard",
            totalOrders: 3,
            totalRevenueCents: 27000,
            avgOrderValueCents: 9000,
            periodStart: "2024-06-01",
            periodEnd: "2024-06-30",
          },
        ]}
        agentRole="admin"
      />
    );
    expect(screen.getByText(/3/)).toBeDefined();
  });

  it("cross-agent fragment still shows Redacted for admin role", () => {
    // MarketInsightChart is a strategist-only fragment
    render(
      <A2UISurface
        surface="SURFACE:strategy"
        components={[{ type: "MarketInsightChart", data: {} }]}
        agentRole="admin"
      />
    );
    expect(screen.getByText(/restricted/i)).toBeDefined();
  });

  it("BusinessProfileCard renders inside A2UISurface", () => {
    render(
      <A2UISurface
        surface="SURFACE:admin_profile"
        components={[
          {
            type: "BusinessProfileCard",
            businessName: "A2UI Shop",
            shopDescription: "Test shop",
            entityType: "sole_proprietor",
            addressLine1: "1 Test Rd",
            city: "Salem",
            state: "OR",
            postalCode: "97301",
            country: "US",
          },
        ]}
        agentRole="admin"
      />
    );
    expect(screen.queryByText("Error")).toBeNull();
    expect(screen.getByText(/A2UI Shop/)).toBeDefined();
  });
});
