# Feature: Auth — Email/Password

## What to Build

Complete authentication flow for email/password registration and login.

### Endpoints

- `POST /api/v1/auth/register` — creates tenant + user atomically; returns JWT
- `POST /api/v1/auth/login` — verifies credentials; returns JWT
- `POST /api/v1/auth/logout` — invalidates session (token blocklist in Redis)
- `GET /api/v1/auth/me` — returns current user + tenant info

### JWT

- HS256, signed with `SECRET_KEY` from env
- Payload: `{sub: user_id, tenant_id, role, exp}`
- Expiry: 7 days (configurable via `JWT_EXPIRY_DAYS`)
- Blocklist: on logout, token `jti` is stored in Redis with TTL = remaining expiry

### Registration Flow

```
POST /api/v1/auth/register
{
  "email": "maker@example.com",
  "password": "...",        -- min 8 chars
  "business_name": "..."    -- used to generate tenant slug
}

→ BEGIN TRANSACTION
→ INSERT INTO tenants (slug from business_name, plan_tier='starter')
→ INSERT INTO users (tenant_id, email, password_hash, role='owner')
→ COMMIT
→ Return JWT
```

Slug generation: lowercase, spaces → hyphens, strip non-alphanumeric, append 4-char random suffix for uniqueness.

### Password Hashing

`bcrypt` via `passlib`. Never store plaintext.

### Tenant Middleware

FastAPI dependency injected on all protected routes:
1. Extract Bearer token from `Authorization` header
2. Verify signature + expiry
3. Check token `jti` not in Redis blocklist
4. Set `app.tenant_id` on the DB connection
5. Inject `current_user` into route handler

### Onboarding Redirect

After registration, response includes `{"onboarding": true}` flag so frontend redirects to onboarding wizard.

## Out of Scope

- Google OAuth (v2)
- Password reset flow (v2)
- Email verification (v2)
- Multi-user per tenant invites (v2)
