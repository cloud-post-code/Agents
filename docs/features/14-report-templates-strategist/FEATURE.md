# Feature: Report Templates — Strategist Agent (5 Reports)

## What to Build

Data pipelines and Jinja2 templates for the 5 Strategist-owned reports.

### Report 1: Business Health Summary

**Template ID:** `business_health_summary`
**Cadence:** Daily (auto-generated each morning)
**Key Metrics:** Revenue MTD, gross margin %, total orders MTD, average order value, period-over-period change vs last month same period; 3-sentence LLM-generated executive summary
**Layout:** StatRow with 5 KPI cards; MetricRow table with period comparison; LLM summary paragraph
**Modeled on:** Shopify Finance Summary

### Report 2: Revenue Over Time

**Template ID:** `revenue_over_time`
**Cadence:** Weekly
**Key Metrics:** Gross sales, net sales, refunds by day/week/month; trend direction; best and worst period in range
**Data Sources:** `orders` aggregated by date bucket; `params.granularity` (day/week/month)
**Layout:** StatRow totals; grouped table by period; trend narrative from LLM
**Modeled on:** Shopify Total Sales Over Time

### Report 3: Gross Profit by Product

**Template ID:** `gross_profit_by_product`
**Cadence:** Monthly
**Key Metrics:** Net sales, COGS (from `products.cost`), gross profit, gross margin % per product; sorted by profit descending
**Warning State:** Products with `cost = NULL` or `cost = 0` shown in a separate section with "Cost not set — margin unavailable" label
**Layout:** Two tables: products with cost data (full metrics) + products without cost (revenue only with warning)
**Modeled on:** Shopify Gross Profit by Product

### Report 4: Channel Revenue Comparison

**Template ID:** `channel_revenue_comparison`
**Cadence:** Weekly
**Key Metrics:** Revenue, units sold, AOV, conversion rate per channel; period-over-period change per channel
**Data Sources:** `orders.channel` grouped aggregation; conversion rate from `product_sync_status` views if available
**Layout:** CompareGrid of top channels; ChannelRow table with all channels; SummaryPanel with winning channel
**Modeled on:** Shopify Sales by Channel + Etsy Stats

### Report 5: Customer Segments

**Template ID:** `customer_segments`
**Cadence:** Monthly
**Key Metrics:** New vs returning customer split (count + revenue); avg orders per returning customer; top customers by revenue (anonymized)
**Data Sources:** `orders.customer_email` first-seen logic; grouped aggregations
**Layout:** StatRow (new/returning counts); CardGrid comparison; Table top customers
**Modeled on:** Shopify New vs Returning + simplified RFM
