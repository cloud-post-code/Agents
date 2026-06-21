# 🚀 Railway Deployment Guide - PostgreSQL Setup

## Quick Start: Deploy to Railway with PostgreSQL

### Step 1: Create PostgreSQL Database

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Open your `artisan-platform` project
3. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
4. Railway automatically provisions and sets these variables:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

✅ **Done!** Your backend will automatically use these.

---

### Step 2: Set Application Environment Variables

Click on your **backend service** → **Variables** tab → **New Variable**

Add these variables:

```bash
APP_ENV=production
DEBUG=false
SECRET_KEY=<generate-secure-key>
CORS_ORIGINS=https://your-frontend.railway.app
OPENAI_API_KEY=sk-your-key-here
```

#### Generate Secure SECRET_KEY

```bash
# Run this command:
openssl rand -hex 32

# Or:
python -c "import secrets; print(secrets.token_hex(32))"

# Copy the output and paste as SECRET_KEY value
```

---

### Step 3: Update CORS Origins

After your frontend deploys, update `CORS_ORIGINS`:

```bash
# In Railway Variables:
CORS_ORIGINS=https://artisan-platform-frontend.railway.app

# Multiple origins (comma-separated):
CORS_ORIGINS=https://frontend.railway.app,https://custom-domain.com
```

---

### Step 4: Deploy

Railway auto-deploys when you push to GitHub:

```bash
git add .
git commit -m "Configure Railway PostgreSQL"
git push origin main
```

Or trigger manual deploy in Railway dashboard.

---

### Step 5: Verify Deployment

#### Check Logs

Railway Dashboard → Deployments → Logs

Look for:
```
✓ Database connection: postgresql+asyncpg://postgres:***@******.railway.app:5432/railway
✓ Redis connection: redis://...
✓ Starting server...
✓ Health check passed: /api/v1/health
```

#### Test Health Endpoint

```bash
curl https://your-backend.railway.app/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

---

## Environment Variable Reference

### Required Variables (Set Manually)

| Variable | Example | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Environment mode |
| `DEBUG` | `false` | Debug mode (false in prod) |
| `SECRET_KEY` | `abc123...` | JWT secret (64 chars) |
| `CORS_ORIGINS` | `https://...` | Frontend URL(s) |
| `OPENAI_API_KEY` | `sk-...` | OpenAI API key |

### Auto-Provided by Railway

| Variable | Description |
|----------|-------------|
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port (5432) |
| `PGUSER` | Database user (postgres) |
| `PGPASSWORD` | Database password |
| `PGDATABASE` | Database name (railway) |

---

## Database Migrations

Migrations run automatically on deploy via Dockerfile:

```dockerfile
# In backend/Dockerfile
RUN alembic upgrade head
```

### Manual Migration

If needed, run manually via Railway CLI:

```bash
railway run alembic upgrade head
```

---

## Redis Configuration (Optional)

Add Redis service for caching:

1. Railway Dashboard → **"New"** → **"Add Redis"**
2. Railway sets `REDIS_URL` automatically
3. Backend uses it automatically ✓

---

## Troubleshooting

### Issue: Connection Refused

```
Error: Connection refused to PostgreSQL
```

**Solution:**
1. Verify PostgreSQL service is running (Railway Dashboard)
2. Check that `PGHOST` is set (should end in `.railway.app`)
3. Restart backend service

---

### Issue: SSL Required

```
Error: SSL connection required
```

**Solution:**
✅ Already handled! Config automatically adds `?sslmode=require` for Railway hosts.

If still issues, verify in logs that URL includes `sslmode=require`.

---

### Issue: CORS Error

```
Error: CORS policy blocked
```

**Solution:**
Update `CORS_ORIGINS` to match your frontend URL exactly:

```bash
# In Railway Variables:
CORS_ORIGINS=https://artisan-platform-frontend.railway.app
```

---

### Issue: OpenAI API Errors

```
Error: Missing OpenAI API key
```

**Solution:**
Set `OPENAI_API_KEY` in Railway Variables:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

---

## Testing Railway Setup Locally

Want to test Railway database from your local machine?

Create `.env.railway`:

```bash
# .env.railway - DO NOT COMMIT
PGHOST=your-project.railway.app
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your-railway-password
PGDATABASE=railway

APP_ENV=production
DEBUG=false
SECRET_KEY=test-key
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379/0
```

Add to `.gitignore`:
```
.env.railway
```

Test connection:
```bash
cd backend
export $(cat .env.railway | xargs)
.venv/bin/python -c "
from app.core.config import settings
print(settings.database_url)
"
```

---

## Production Checklist

Before going live:

- [ ] PostgreSQL database created in Railway ✓
- [ ] Environment variables set in Railway:
  - [ ] `APP_ENV=production`
  - [ ] `DEBUG=false`
  - [ ] `SECRET_KEY` (64-char random string)
  - [ ] `CORS_ORIGINS` (frontend URL)
  - [ ] `OPENAI_API_KEY`
- [ ] Frontend deployed and URL set in `CORS_ORIGINS`
- [ ] Health check endpoint returns 200 OK
- [ ] Database migrations ran successfully
- [ ] Test login/auth flow
- [ ] Test file upload (image/CSV)
- [ ] Test agent chat
- [ ] Check Railway logs for errors
- [ ] Monitor resource usage (Database/Redis connections)

---

## Monitoring

### Railway Metrics

Railway Dashboard → Metrics shows:
- CPU usage
- Memory usage
- Network traffic
- Database connections
- Request count

### Application Logs

View real-time logs:
```bash
# Railway CLI
railway logs --service backend

# Or in Dashboard → Deployments → Logs
```

---

## Cost Optimization

### PostgreSQL

Railway PostgreSQL is free for development, paid for production.

**Optimize:**
- Set connection pool size appropriately
- Close unused connections
- Use indexes on frequently queried columns

### Redis

Optional but recommended for:
- Session caching
- Rate limiting
- Background job queues

---

## Summary

**Local Development**: Uses `localhost:5433` PostgreSQL
**Railway Production**: Auto-detects Railway PostgreSQL via `PGHOST`, `PGPORT`, etc.

**Changes Made:**
✅ Updated `backend/app/core/config.py` to auto-detect Railway
✅ Added SSL for Railway connections
✅ Created `.env.railway.template` for reference
✅ Created deployment guide

**Next Steps:**
1. Create PostgreSQL in Railway
2. Set environment variables
3. Push to deploy
4. Verify health check
5. Test end-to-end

Your app is ready for Railway! 🚀
