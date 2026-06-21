# Railway Production Environment Variables Configuration

## Required Railway Environment Variables

Railway provides these automatically when you provision a PostgreSQL database:

### PostgreSQL (Provided by Railway)
```
PGHOST=<railway-postgres-host>
PGPORT=<railway-postgres-port>
PGUSER=postgres
PGPASSWORD=<railway-generated-password>
PGDATABASE=railway
```

### Application Environment Variables (Set Manually in Railway)

```bash
# App Environment
APP_ENV=production
DEBUG=false

# JWT Secret (Generate a secure random string)
SECRET_KEY=<generate-strong-secret-key>

# CORS Origins (Your frontend URL)
CORS_ORIGINS=https://your-frontend.railway.app

# OpenAI API Key (For product ingestion)
OPENAI_API_KEY=sk-...

# Redis (Railway will provide if you add Redis service)
# Or use Railway's provided REDIS_URL
REDIS_URL=${REDIS_URL}
```

## Database URL Construction

The app automatically constructs `DATABASE_URL` from Railway's PostgreSQL variables.

Edit `backend/app/core/config.py` to use Railway's variables:

### Current Code:
```python
database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/artisan"
```

### Update to:
```python
import os

# Build DATABASE_URL from Railway's native PostgreSQL variables
def _build_database_url() -> str:
    """Build async PostgreSQL URL from Railway's PGHOST/PGPORT/etc."""
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5432")
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "postgres")
    database = os.environ.get("PGDATABASE", "railway")
    
    # Use asyncpg for async SQLAlchemy
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"

def _build_database_url_sync() -> str:
    """Build sync PostgreSQL URL from Railway's variables."""
    host = os.environ.get("PGHOST", "localhost")
    port = os.environ.get("PGPORT", "5432")
    user = os.environ.get("PGUSER", "postgres")
    password = os.environ.get("PGPASSWORD", "postgres")
    database = os.environ.get("PGDATABASE", "railway")
    
    # Use psycopg2 for sync operations
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"

class Settings(BaseSettings):
    # Database - defaults from Railway
    database_url: str = _build_database_url()
    database_url_sync: str = _build_database_url_sync()
    
    # ... rest of settings
```

## Railway Setup Steps

### 1. Create PostgreSQL Database

```bash
# In Railway dashboard:
# 1. Go to your project
# 2. Click "New" → "Database" → "Add PostgreSQL"
# 3. Railway automatically sets PGHOST, PGPORT, etc.
```

### 2. Set Environment Variables

In Railway dashboard → Variables:

```
APP_ENV=production
DEBUG=false
SECRET_KEY=your-super-secret-key-here-generate-random-64-chars
CORS_ORIGINS=https://artisan-platform-frontend.railway.app
OPENAI_API_KEY=sk-your-openai-key-here
```

### 3. Deploy

```bash
# Railway auto-deploys on git push
git add .
git commit -m "Configure Railway PostgreSQL"
git push origin main
```

## Testing Railway Connection Locally

Create a `.env.railway` file for testing Railway setup locally:

```bash
# .env.railway - DO NOT COMMIT
PGHOST=<your-railway-host>.railway.app
PGPORT=5432
PGUSER=postgres
PGPASSWORD=<railway-password>
PGDATABASE=railway

APP_ENV=production
DEBUG=false
SECRET_KEY=test-secret-key
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379/0
```

Then test:
```bash
# Load Railway env and test connection
cd backend
source .env.railway  # or: export $(cat .env.railway | xargs)
.venv/bin/python -c "
from app.core.config import settings
print(f'DB URL: {settings.database_url}')
"
```

## Environment File Structure

```
backend/
├── .env                 # Local development (localhost PostgreSQL)
├── .env.test           # Test environment (localhost:5434)
├── .env.railway        # Local testing with Railway DB (gitignored)
└── .gitignore          # Ensure .env.railway is ignored
```

Add to `.gitignore`:
```
.env
.env.local
.env.railway
.env.*.local
```

## Verifying Railway PostgreSQL

After deploying, check Railway logs:

```bash
# In Railway dashboard → Deployments → Logs
# Look for:
✓ Database connection: postgresql+asyncpg://postgres:***@******.railway.app:5432/railway
✓ Health check passed: /api/v1/health
```

## Running Migrations on Railway

```bash
# Railway runs migrations automatically via Dockerfile
# But you can also run manually:

railway run alembic upgrade head
```

## Production Checklist

- [ ] PostgreSQL database created in Railway
- [ ] Environment variables set in Railway dashboard
- [ ] `APP_ENV=production` set
- [ ] `DEBUG=false` set
- [ ] Strong `SECRET_KEY` generated
- [ ] `CORS_ORIGINS` set to frontend URL
- [ ] `OPENAI_API_KEY` set
- [ ] Database migrations run
- [ ] Health check endpoint working
- [ ] Frontend can connect to backend
- [ ] File uploads working
- [ ] Agent chat working

## Troubleshooting

### Connection Refused
```
Error: Connection refused to PostgreSQL

Solution:
1. Check PGHOST is correct (should end in .railway.app)
2. Verify PostgreSQL service is running in Railway
3. Check firewall rules (Railway should handle this)
```

### Authentication Failed
```
Error: password authentication failed

Solution:
1. Verify PGPASSWORD matches Railway's generated password
2. Check Railway dashboard → PostgreSQL → Variables
3. Regenerate database if needed
```

### SSL Required
```
Error: SSL required

Solution:
Add to database URL: ?sslmode=require

Update _build_database_url():
return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}?sslmode=require"
```

## Redis Configuration

Railway also provides Redis. Add Redis service:

```bash
# Railway dashboard:
# New → Add Redis

# Railway sets: REDIS_URL automatically
```

Then in config:
```python
redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
```

## Summary

**Local Development**: Uses `localhost:5433`
**Railway Production**: Uses Railway PostgreSQL (PGHOST, PGPORT, etc.)

**Next Steps**:
1. Update `backend/app/core/config.py` with Railway variable logic
2. Create PostgreSQL database in Railway
3. Set environment variables in Railway dashboard
4. Deploy and verify connection
