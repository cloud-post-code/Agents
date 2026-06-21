# Feature: Report Templates — Marketer + Product Manager (9 Reports)

## What to Build

Data pipelines and Jinja2 templates for 6 Marketer-owned reports and 3 Product Manager-owned reports.

---

## Marketer Reports

### Report 9: Returns and Refunds

**Template ID:** `returns_and_refunds`
**Cadence:** Weekly
**Key Metrics:** Return count, total refund value, return rate (% of orders), top returned products by count, return reasons breakdown
**Data Sources:** `returns` JOIN `order_line_items` JOIN `products`
**Layout:** StatRow KPIs; Table products by return count; reason breakdown pie-like grouped table

### Report 13: Product Performance

**Template ID:** `product_performance`
**Cadence:** Weekly
**Key Metrics:** Views, favorites/saves, units sold, revenue, conversion rate per listing; sorted by revenue
**Data Sources:** `products` + `orders` aggregation; views/favorites from `product_analytics` table (platform-tracked or Facebook-synced)
**Layout:** Table[ListingRow]: product image, title, channel badge, rating, units sold, price, conversion rate

### Report 14: Traffic Sources

**Template ID:** `traffic_sources`
**Cadence:** Weekly
**Key Metrics:** Sessions by channel (organic, direct, paid, social, email, marketplace); period-over-period change per channel
**Data Sources:** `traffic_events` table (populated by channel sync or UTM tracking)
**Note:** May show "Insufficient data — connect a channel to see traffic sources" if no channel data available
**Layout:** StatRow total sessions; Table[ChannelRow] breakdown; CompareGrid top 3 channels

### Report 15: Top Search Terms

**Template ID:** `top_search_terms`
**Cadence:** Weekly
**Key Metrics:** Search queries driving visits; click-through rate per term; flagged terms with no results (opportunity signals)
**Data Sources:** `search_events` table (from Facebook Commerce Manager or Etsy search data)
**Layout:** Table sorted by visits; highlighted row for no-result terms

### Report 16: Conversion Funnel

**Template ID:** `conversion_funnel`
**Cadence:** Weekly
**Key Metrics:** Views → Add to cart → Checkout initiated → Purchase at each stage; drop-off % between stages
**Data Sources:** `funnel_events` table (channel-specific; may be partial if only Facebook connected)
**Layout:** Funnel visualization as grouped StatRow with drop-off % between each stage; LLM insight paragraph

---

## Product Manager Reports

### Report 11: Inventory Health

**Template ID:** `inventory_health`
**Cadence:** Daily (auto-generated each morning)
**Key Metrics:** Total SKUs, total stock value, low-stock SKU count, out-of-stock SKU count, sell-through rate (units sold / starting inventory), days of inventory remaining per SKU
**Data Sources:** `products`, `product_variants`, `stock_adjustments`
**Layout:** StatRow 5 KPIs; Table[ProductRow+StockBadge] sorted by days-remaining ascending (most urgent first)

### Report 12: Inventory Movement

**Template ID:** `inventory_movement`
**Cadence:** Weekly
**Key Metrics:** Units added (restocks), units sold, units adjusted (shrinkage/corrections), net change per product per period
**Data Sources:** `stock_adjustments` grouped by `reason` type
**Layout:** GroupedTable by product; each group shows adjustment rows by type with net change row

### Report 17: Supplier Spend

**Template ID:** `supplier_spend`
**Cadence:** Monthly
**Key Metrics:** Total spend per supplier, PO count, average lead time, active materials count
**Data Sources:** `suppliers`, `purchase_orders` tables
**Note:** Shows "No supplier data — add your suppliers to see spend analysis" if no supplier data
**Layout:** Table[SupplierRow] sorted by spend descending; SummaryPanel total spend

### Supporting Tables

```sql
product_analytics
  id, tenant_id, product_id, channel, views, favorites, date, created_at

traffic_events
  id, tenant_id, channel, source, sessions, date, created_at

search_events
  id, tenant_id, channel, search_term, visits, clicks, results_count, date, created_at

funnel_events
  id, tenant_id, channel, stage, count, date, created_at

suppliers
  id, tenant_id, name, contact_info JSONB, lead_time_days, notes, created_at

purchase_orders
  id, tenant_id, supplier_id, total_amount, status, ordered_at, received_at, created_at
```
