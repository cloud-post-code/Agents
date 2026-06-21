"use client";

import React from "react";
import { AgentRole, isAllowedFragment } from "./catalog";
import { RedactedFragment } from "./RedactedFragment";
import { PriceTag } from "./atoms/PriceTag";
import { StockBadge } from "./atoms/StockBadge";
import { StatusPill } from "./atoms/StatusPill";
import { PercentChange } from "./atoms/PercentChange";
import { DateLabel } from "./atoms/DateLabel";
import { ApprovalTag } from "./atoms/ApprovalTag";
import { ProductRow } from "./rows/ProductRow";
import { StatRow } from "./rows/StatRow";
import { OrderRow } from "./rows/OrderRow";
import { Table } from "./containers/Table";
import { ApprovalBlock } from "./containers/ApprovalBlock";
import { CompareGrid } from "./containers/CompareGrid";
import { SummaryPanel } from "./containers/SummaryPanel";

export interface A2UIComponent {
  type: string;
  children?: A2UIComponent[];
  [key: string]: any;
}

interface A2UISurfaceProps {
  surface: string;
  components: A2UIComponent[];
  agentRole: AgentRole;
  className?: string;
}

const MAX_DEPTH = 3;

function renderComponent(comp: A2UIComponent, agentRole: AgentRole, depth = 0): React.ReactNode {
  if (depth >= MAX_DEPTH) return null;

  const { type, children, ...props } = comp;

  if (!isAllowedFragment(agentRole, type)) {
    return <RedactedFragment key={type} />;
  }

  const renderedChildren = children?.map((c, i) =>
    renderComponent({ ...c, key: i }, agentRole, depth + 1)
  );

  switch (type) {
    case "PriceTag":
      return <PriceTag key={comp.key} amount={props.amount} currency={props.currency} />;
    case "StockBadge":
      return (
        <StockBadge
          key={comp.key}
          quantity={props.quantity}
          lowThreshold={props.lowThreshold}
          outThreshold={props.outThreshold}
        />
      );
    case "StatusPill":
      return <StatusPill key={comp.key} status={props.status} />;
    case "PercentChange":
      return <PercentChange key={comp.key} value={props.value} />;
    case "DateLabel":
      return <DateLabel key={comp.key} date={props.date} format={props.format} />;
    case "ApprovalTag":
      return <ApprovalTag key={comp.key} action={props.action} label={props.label} />;
    case "ProductRow":
      return (
        <ProductRow
          key={comp.key}
          name={props.name}
          sku={props.sku}
          price={props.price}
          stockQty={props.stockQty}
        />
      );
    case "StatRow":
      return (
        <StatRow key={comp.key} label={props.label} value={props.value} subtext={props.subtext}>
          {renderedChildren}
        </StatRow>
      );
    case "OrderRow":
      return (
        <OrderRow
          key={comp.key}
          orderId={props.orderId}
          customerName={props.customerName}
          total={props.total}
          status={props.status}
        />
      );
    case "Table":
      return (
        <Table key={comp.key} headers={props.headers}>
          {renderedChildren}
        </Table>
      );
    case "ApprovalBlock":
      return <ApprovalBlock key={comp.key}>{renderedChildren}</ApprovalBlock>;
    case "CompareGrid":
      return (
        <CompareGrid
          key={comp.key}
          items={props.items ?? []}
          renderItem={(item: any) => <div>{JSON.stringify(item)}</div>}
        />
      );
    case "SummaryPanel":
      return (
        <SummaryPanel key={comp.key} title={props.title}>
          {renderedChildren}
        </SummaryPanel>
      );
    default:
      return (
        <div key={comp.key} className="text-sm text-gray-500">
          [{type}]
        </div>
      );
  }
}

export function A2UISurface({ surface, components, agentRole, className }: A2UISurfaceProps) {
  return (
    <div data-surface={surface} className={`a2ui-surface space-y-3 ${className ?? ""}`}>
      {components.map((comp, i) => (
        <React.Fragment key={i}>{renderComponent(comp, agentRole, 0)}</React.Fragment>
      ))}
    </div>
  );
}
