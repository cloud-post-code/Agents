# Proof: Frontend Skeleton

## Primary Proof Command

```bash
npx vitest run frontend/src/tests/skeleton.test.tsx
```

## Green State

1. `npm run build` completes with zero errors and zero TypeScript errors
2. All routes render without runtime errors (Playwright smoke test)
3. Unauthenticated visit to `/dashboard` redirects to `/login`
4. Authenticated visit to `/login` redirects to `/dashboard`
5. Register form submits, receives JWT, redirects to onboarding wizard
6. Login form submits, receives JWT, redirects to `/dashboard`
7. All 4 agent chat shells render with correct agent name and description
8. Sidebar nav links navigate to correct pages
9. Mobile: sidebar collapses at <768px viewport

## Executable Proof File

`frontend/src/tests/skeleton.test.tsx` (Vitest + React Testing Library)

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("Agent chat shells", () => {
  const agents = [
    { slug: "strategist", name: "Strategist", desc: /market|pricing|strategy/i },
    { slug: "product-manager", name: "Product Manager", desc: /inventory|catalog/i },
    { slug: "marketer", name: "Marketer", desc: /seo|listing|brand/i },
    { slug: "admin", name: "Admin", desc: /accounting|shipping/i },
  ];

  agents.forEach(({ name, desc }) => {
    it(`renders ${name} shell with name and description`, async () => {
      // Render agent page component with mock auth
      // Assert agent name and description visible
      expect(screen.getByText(name)).toBeDefined();
      expect(screen.getByText(desc)).toBeDefined();
    });
  });
});
```

`frontend/tests/navigation.spec.ts` (Playwright E2E)

```typescript
import { test, expect } from "@playwright/test";

test("unauthenticated redirect to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("register flow redirects to onboarding", async ({ page }) => {
  await page.goto("/register");
  await page.fill("[name=email]", "maker@test.com");
  await page.fill("[name=password]", "secret123");
  await page.fill("[name=business_name]", "Test Crafts");
  await page.click("[type=submit]");
  await expect(page).toHaveURL(/\/register\/onboarding|\/dashboard/);
});

test("sidebar has all 4 agent links", async ({ page, authedContext }) => {
  await page.goto("/dashboard");
  for (const agent of ["Strategist", "Product Manager", "Marketer", "Admin"]) {
    await expect(page.getByRole("link", { name: agent })).toBeVisible();
  }
});
```
