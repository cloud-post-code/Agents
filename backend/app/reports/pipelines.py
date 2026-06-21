"""Report data pipelines — one async function per template_id."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def fetch_orders_log(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"orders": [], "date_from": date_from, "date_to": date_to, "tenant_id": tenant_id}


async def fetch_order_line_items(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"line_items": [], "date_from": date_from, "date_to": date_to}


async def fetch_monthly_financial_statement(tenant_id: str, year: int = None, month: int = None, **_) -> dict:
    return {"events": [], "net_total": 0, "year": year, "month": month}


async def fetch_fulfillment_performance(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"on_time_rate": 0.0, "avg_days_to_ship": 0.0, "orders": []}


async def fetch_business_health_summary(tenant_id: str, **_) -> dict:
    return {"revenue_mtd": 0, "gross_margin": 0, "orders_mtd": 0, "aov": 0}


async def fetch_revenue_over_time(tenant_id: str, granularity: str = "day", **_) -> dict:
    return {"periods": [], "granularity": granularity}


async def fetch_gross_profit_by_product(tenant_id: str, year: int = None, month: int = None, **_) -> dict:
    return {"products_with_cost": [], "products_no_cost": []}


async def fetch_channel_revenue_comparison(tenant_id: str, **_) -> dict:
    return {"channels": []}


async def fetch_customer_segments(tenant_id: str, **_) -> dict:
    return {"new_customer_count": 0, "returning_customer_count": 0, "top_customers": []}


async def fetch_inventory_health(tenant_id: str, **_) -> dict:
    return {"products": [], "total_skus": 0, "low_stock_count": 0}


async def fetch_inventory_movement(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"products": []}


async def fetch_product_performance(tenant_id: str, **_) -> dict:
    return {"products": []}


async def fetch_traffic_sources(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"insufficient_data": True, "sources": []}


async def fetch_top_search_terms(tenant_id: str, **_) -> dict:
    return {"terms": []}


async def fetch_conversion_funnel(tenant_id: str, date_from: str = None, date_to: str = None, **_) -> dict:
    return {"stages": []}


async def fetch_supplier_spend(tenant_id: str, **_) -> dict:
    return {"suppliers": [], "total_spend": 0}


async def fetch_returns_and_refunds(tenant_id: str, **_) -> dict:
    return {"return_count": 0, "refund_total": 0, "products": []}
