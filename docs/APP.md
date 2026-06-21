# Artisan Business Platform — App Brief

## What It Is

A multi-tenant SaaS platform that gives local artisans an expert AI team to run their business. Each artisan workspace has four AI co-workers — Strategist, Product Manager, Marketer, and Admin — each accessible via chat and capable of generating dynamic UI surfaces and downloadable reports on demand.

## Target User

Independent artisans and small craft businesses selling handmade goods across one or more channels (Etsy, Facebook, in-person). They are skilled makers but not business operators — they need expert guidance on pricing, inventory, marketing, and admin without hiring a team.

## Core Outcome

An artisan opens the platform, asks their Strategist "should I lower my prices for the holiday season?", gets a real analysis with charts and a recommendation, approves a repricing task, and sees it in the calendar — all in one session. No spreadsheets, no guesswork.

## Product Shape

- **4 agent chat interfaces** — one per co-worker, each with a short description and persistent chat history
- **A2UI surfaces** — agents render dynamic, structured UI inline in chat (tables, KPI cards, comparison grids) assembled from a catalog of atomic fragments
- **Task queue** — agents create tasks requiring human approval before execution; artisan reviews and approves
- **In-app notification feed** — alerts for pending tasks, completed reports, and agent status
- **Standalone calendar** — agent-created and human-created events in one place
- **Report archive** — 18 fixed report templates generated as PDF + HTML, triggered by agent or on schedule
- **Facebook inventory sync** — platform is source of truth; syncs product catalog to Facebook in v1

## Scope Cuts (v1)

- No Google OAuth (email/password only)
- No Etsy/Shopify sync (Facebook only)
- No email notifications (in-app feed only)
- No custom report builder (18 fixed templates)
- No ad spend / ROAS reports
- No tax form generation
- No external calendar sync
- No agent-to-agent autonomous handoffs (human always in the loop)

## Multi-Tenancy Model

Each artisan account is an isolated tenant. Every data record is scoped to a `tenant_id`. Postgres Row Level Security enforces isolation at the database layer. Registration atomically creates a tenant and an owner user — there is no tenant-less state.

## Plan Tiers

`starter` / `grow` / `pro` — gates agent capabilities, report access, and integration limits. Data model is uniform across tiers; only API surface changes.
