# Feature: Report Templates — Admin Agent (4 Reports)

## What to Build

Data pipelines and Jinja2 templates for the 4 Admin-owned reports.

### Report 6: Monthly Financial Statement

**Template ID:** `monthly_financial_statement`
**Cadence:** Monthly (auto-generated on 1st of each month for prior month)
**Key Metrics:** Every balance event: sales, fees (platform + payment processing), refunds, ad spend (if any), net per line, running total; one month at a time
**Data Sources:** `orders`, `order_fees`, `refunds`, `expense_rows` tables; all filtered by `created_at` month range
**Layout:** Grouped table by event type; subtotals per group; grand total net row at bottom
**Modeled on:** Etsy Monthly Statement

### Report 7: Orders Log

**Template ID:** `orders_log`
**Cadence:** On-demand (agent trigger or user trigger)
**Key Metrics:** Order ID, date, customer name (anonymized option), channel, items summary, gross, discounts, shipping, tax, net, status
**Data Sources:** `orders` + `order_line_items` tables
**Layout:** Table with one row per order; sortable by date, amount, status
**Export:** Also available as CSV download
**Modeled on:** Etsy Orders CSV

### Report 8: Order Line Items

**Template ID:** `order_line_items`
**Cadence:** On-demand
**Key Metrics:** One row per line item: product name, variant, quantity, unit price, order total, SKU, ship date, channel
**Data Sources:** `order_line_items` JOIN `orders` JOIN `products`
**Layout:** Table; exportable as CSV
**Modeled on:** Etsy Order Items CSV

### Report 18: Fulfillment Performance

**Template ID:** `fulfillment_performance`
**Cadence:** Weekly
**Key Metrics:** On-time ship rate (%), avg days to ship, delayed orders count, return rate (%), breakdown by product category; tracks against Etsy Star Seller thresholds (ship within 3 days, <1% cases)
**Data Sources:** `orders` (shipped_at, created_at), `returns`
**Layout:** StatRow KPIs at top; Table breakdown by category; Star Seller threshold indicator bar
**Modeled on:** Etsy Star Seller dashboard + Shopify Order to Fulfillment Time

### Supporting Tables Needed

```sql
orders
  id, tenant_id, channel, customer_name, customer_email
  status, gross_amount, discount_amount, shipping_amount, tax_amount, net_amount
  created_at, shipped_at, delivered_at

order_line_items
  id, tenant_id, order_id, product_id, variant_id, product_name, variant_name
  quantity, unit_price, line_total, sku

order_fees
  id, tenant_id, order_id, fee_type (platform/payment/other), amount, created_at

returns
  id, tenant_id, order_id, reason, refund_amount, status, created_at
```

These tables are created in the migration for this feature.
