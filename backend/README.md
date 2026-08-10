# 薪火未来 — FastAPI Backend

FastAPI backend for the Xinhuo Future student growth & career decision platform.

## Quick Start

```bash
# Start MySQL + Backend
docker compose up -d

# Run migrations
docker compose exec backend alembic upgrade head

# Import reference data
docker compose exec backend python scripts/import_reference_data.py --type all

# API docs at http://localhost:8000/docs
# Health check at http://localhost:8000/health
```

## Local Development (without Docker)

```bash
# 1. Start MySQL
# 2. Create .env from .env.example
cp .env.example .env
# Edit .env with your MySQL credentials

# 3. Install dependencies
pip install -r requirements.txt
pip install aiomysql

# 4. Run migrations
alembic upgrade head

# 5. Start server
uvicorn app.main:app --reload --port 8000
```

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── core/                 # Config, security, exceptions, logging
│   ├── db/                   # SQLAlchemy base, session
│   ├── modules/              # Business modules
│   │   ├── auth/             # Authentication
│   │   ├── users/            # User & student profiles
│   │   ├── reference/        # Standard dictionaries
│   │   ├── organization/     # Universities, colleges, majors
│   │   ├── admission/        # Admission records (Phase 2)
│   │   ├── employment/       # Employment records (Phase 2)
│   │   ├── evidence/         # Growth evidence (Phase 2)
│   │   ├── growth/           # Growth tasks (Phase 2)
│   │   ├── career/           # Career jobs & matching (Phase 2)
│   │   ├── interview/        # Mock interviews (Phase 2)
│   │   ├── admin/            # Admin & audit (Phase 2)
│   │   ├── files/            # Unified file storage
│   │   └── imports/          # Data import staging
│   ├── integrations/         # COS, LLM, ASR, TTS, OCR
│   └── tests/                # pytest tests
├── alembic/                  # Database migrations
├── scripts/                  # Import & utility scripts
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Environment Variables

See `.env.example` for all available variables.

Key variables:
- `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD`
- `COS_SECRET_ID` / `COS_SECRET_KEY` / `COS_BUCKET` / `COS_REGION`
- `SECRET_KEY`
- `WEB_ORIGIN`

## Testing

```bash
# Run all tests
pytest

# Unit tests only
pytest -m unit

# With coverage
pip install pytest-cov
pytest --cov=app --cov-report=html
```
