"""Facebook Commerce Catalog API client (mock-friendly)."""
from __future__ import annotations

import httpx


class FacebookCatalogClient:
    def __init__(self, access_token: str, catalog_id: str):
        self.access_token = access_token
        self.catalog_id = catalog_id
        self.base_url = "https://graph.facebook.com/v18.0"

    async def upsert_product(self, product_data: dict) -> dict:
        """Push a product to the Facebook catalog. Returns {'id': fb_item_id}."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/{self.catalog_id}/products",
                params={"access_token": self.access_token},
                json=product_data,
                timeout=15.0,
            )
            r.raise_for_status()
            return r.json()

    async def delete_product(self, retailer_id: str) -> None:
        """Remove a product from the Facebook catalog."""
        async with httpx.AsyncClient() as client:
            r = await client.delete(
                f"{self.base_url}/{self.catalog_id}/products",
                params={"access_token": self.access_token, "retailer_id": retailer_id},
                timeout=15.0,
            )
            r.raise_for_status()
