/**
 * A2UI catalog registry — defines which fragment types each agent role can render.
 */

export type AgentRole = "strategist" | "product_manager" | "marketer" | "admin";

export const AGENT_CATALOG: Record<AgentRole, Set<string>> = {
  strategist: new Set([
    "PriceTag", "CurrencyAmount", "PercentChange", "MarginPill", "RevenueBar", "TrendArrow",
    "StockBadge", "StatusPill", "DateLabel", "SeasonTag", "QuantityCount", "ConversionRate",
    "ScoreBadge", "UnitsSold", "ChannelBadge", "CustomerTier", "MetricRow", "ForecastRow",
    "CompetitorRow", "ChannelRow", "Table", "GroupedTable", "StatRow", "CompareGrid",
    "SummaryPanel", "CardGrid",
  ]),
  product_manager: new Set([
    "PriceTag", "CurrencyAmount", "MarginPill", "CostBreakdown", "StockBadge", "StatusPill",
    "PriorityFlag", "DueBadge", "LeadTimePill", "DateLabel", "SeasonTag", "QuantityCount",
    "ScoreBadge", "SupplierTag", "AgentBadge", "ProductRow", "ProductCard", "ProductGrid",
    "VariantRow", "MaterialRow", "SupplierRow", "TaskRow", "ForecastRow", "Table", 
    "GroupedTable", "StatRow", "TimelineList", "SummaryPanel",
  ]),
  marketer: new Set([
    "PriceTag", "CurrencyAmount", "PercentChange", "TrendArrow", "StatusPill", "RatingStars",
    "ConversionRate", "ScoreBadge", "UnitsSold", "ChannelBadge", "CustomerTier", "DateLabel",
    "SeasonTag", "AgentBadge", "ListingRow", "ChannelRow", "CampaignRow", "Table", "CardGrid",
    "StatRow", "TimelineList", "CompareGrid", "SummaryPanel",
  ]),
  admin: new Set([
    "CurrencyAmount", "StatusPill", "ApprovalTag", "FulfillmentDot", "PriorityFlag",
    "DelayWarning", "AvatarChip", "AgentBadge", "DateLabel", "DueBadge", "QuantityCount",
    "OrderRow", "LineItemRow", "ReturnRow", "TaskRow", "ExpenseRow", "Table", "GroupedTable",
    "ApprovalBlock", "TimelineList", "StatRow", "SummaryPanel",
  ]),
};

export function isAllowedFragment(role: AgentRole, fragmentType: string): boolean {
  return AGENT_CATALOG[role]?.has(fragmentType) ?? false;
}
