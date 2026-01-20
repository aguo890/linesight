# LineSight 🏭

**AI-Driven Digital Transformation for SMB Apparel Manufacturing**

LineSight is a B2B SaaS platform that bridges the "digital divide" in apparel manufacturing. Using Large Language Models (LLMs) for Semantic ETL, LineSight parses messy Excel spreadsheets and delivers real-time analytics on SAM performance, DHU metrics, and workforce optimization—without requiring immediate behavioral changes from factory staff.

You can see your asssembly line, because its the heartbeat of your operations.

## 🎯 Key Features

- **Semantic ETL**: Parse any Excel format using LLM-powered schema inference
- **Flexible Data Ingestion**: Works with incomplete data - creates records with whatever columns exist
- **SAM Analytics**: Track Standard Allowed Minute performance and line efficiency
- **DHU Dashboard**: Monitor Defects per Hundred Units with root cause analysis
- **Skill Matrix**: Ethical workforce optimization (not punitive leaderboards)
- **UFLPA Compliance**: Full traceability from fabric origin to shipped cartons
- **Multi-Tenant**: Secure organization → factory → line hierarchy
- **Docker Ready**: Full containerization with Docker Compose

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 7 |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | PostgreSQL 15+, SQLAlchemy 2.0 |
| **Migrations** | Alembic |
| **LLM Engine** | DeepSeek-V3 (primary), OpenAI GPT-4o (fallback) |
| **PII Protection** | Microsoft Presidio |
| **Containers** | Docker, Docker Compose |
| **Automation** | GNU Make (Makefile) |
| **Background Jobs** | Celery + Redis |

## 📁 Project Structure

```
FactoryExcelManager/
├── backend/            # FastAPI, PostgreSQL, Celery
│   ├── app/
│   │   ├── api/           # FastAPI endpoints
│   │   ├── core/          # Config, security, database
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic validation
│   │   └── services/      # Excel parser, LLM agent
│   ├── alembic/           # Database migrations
│   ├── Dockerfile         # Backend container
│   └── requirements.txt
├── frontend/           # React 19 + Vite 7
│   ├── Dockerfile         # Frontend container
│   └── package.json
├── scripts/            # Automation utilities
├── docker-compose.yml     # Full stack orchestration
└── README.md
```

## 🐳 Docker Quick Start (Recommended)

The fastest way to get LineSight running is using the included **Makefile**.

```bash
# 1. Clone and enter directory
cd FactoryExcelManager

# 2. Copy environment template
# Windows: copy .env.docker.example .env
# Linux/Mac/WSL2: cp .env.docker.example .env
cp .env.docker.example .env

# 3. Edit .env with your API keys
# - DEEPSEEK_API_KEY (required for LLM features)

# 4. Fresh Start (Build, Up, Migrate)
make setup

# 5. Tail logs
make logs
```

<details>
<summary><b>Manual Setup (No Make)</b></summary>

If you don't have `make` installed, use these raw commands:

```bash
# 1. Build and start containers
docker compose up -d --build

# 2. Run database migrations
docker compose exec backend alembic upgrade head

# 3. View logs
docker compose logs -f
```
</details>

**Services Available:**
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Postgres**: localhost:5434 (Mapped to 5434 to avoid conflicts with local instances on 5432)
- **Redis**: localhost:6379

## 💻 Local Development Setup

### Prerequisites

- **Python 3.11+**
- **PostgreSQL 15+**
- **Node.js 18+** (for frontend)
- **Docker & Docker Compose**
- **GNU Make** (Required for the recommended workflow)
- **GCC / Build Essentials** (Required for some Python dependencies)

> [!IMPORTANT]
> **Windows Users**: It is highly recommended to use **WSL2** (Ubuntu) for local development to ensure compatibility with `make` and Docker. If you are not using WSL2, you can install `make` via [Chocolatey](https://community.chocolatey.org/packages/make) or [MingW](http://www.mingw.org/), or use the raw Docker commands provided in the **Manual Setup** section below.

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials (default port: 5434) and API keys

# Create database
# Using psql:
# psql -U postgres -c "CREATE DATABASE linesight;"

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

### API Documentation

The API is fully documented with OpenAPI/Swagger. Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

These docs are auto-generated from the code and always reflect the current API state.

## 📊 Database Schema

### Core Entities

| Table | Description |
|-------|-------------|
| `organizations` | Multi-tenant SaaS root entity |
| `users` | Platform users with RBAC roles |
| `factories` | Physical manufacturing facilities |
| `production_lines` | Sewing lines within factories |

### File Processing

| Table | Description |
|-------|-------------|
| `excel_uploads` | Uploaded files for Semantic ETL |
| `processing_jobs` | LLM inference and code generation |
| `parsed_datasets` | Cleaned data output tracking |

### Production Domain

| Table | Description |
|-------|-------------|
| `styles` | Garment designs with base SAM |
| `orders` | Purchase orders from buyers |
| `production_runs` | Daily production execution |
| `fabric_lots` | Fabric inventory with origin |
| `cut_tickets` | Cutting instructions |

### Quality & Workforce

| Table | Description |
|-------|-------------|
| `quality_inspections` | In-line and end-line QC |
| `defects` | Individual defect records |
| `workers` | Employee master data |
| `worker_skills` | Skill matrix proficiency |

### Compliance & Analytics

| Table | Description |
|-------|-------------|
| `traceability_records` | UFLPA chain of custody |
| `efficiency_metrics` | Pre-computed line efficiency |
| `dhu_reports` | Aggregated quality reports |

## 📄 Flexible Excel Handling

LineSight is designed to work with **incomplete or minimal Excel files**. The system doesn't require perfect data—it creates records with whatever information is available.

### How It Works

1. **Smart Header Detection**: Finds headers anywhere in the first 20 rows (not just row 1)
2. **Fuzzy Column Matching**: Maps variations like "Qty", "quantity", "QTY", "pcs" → `quantity`
3. **Graceful Ingestion**: Creates records with available fields, leaves others NULL
4. **Type Inference**: Automatically detects dates, numbers, percentages

### Example: Minimal Excel File

Your Excel file only has 3 columns? No problem:

| Style | Qty | Color |
|-------|-----|-------|
| ABC-123 | 500 | Navy |
| XYZ-789 | 300 | Black |

LineSight will:
- Map "Style" → `style_number`
- Map "Qty" → `quantity`  
- Map "Color" → `color`
- Create records with just these fields
- Leave `buyer`, `season`, `sam`, etc. as NULL

### Supported Column Variations

| Target Field | Recognized Names |
|--------------|------------------|
| `style_number` | style, style#, style no, item, sku |
| `quantity` | qty, pcs, pieces, units, order qty |
| `po_number` | po, po#, purchase order, order# |
| `color` | color, colour, colorway, shade |
| `sam` | sam, standard minute, smv |
| `defects` | defects, def, reject, defect count |
| `origin_country` | origin, country, coo, made in |

## 🔐 Security

- **JWT Authentication**: Secure token-based auth
- **RBAC Roles**: Admin, Manager, Analyst, Viewer
- **PII Redaction**: Presidio integration before LLM processing
- **Soft Deletes**: Critical entities are never hard-deleted

## 📈 Roadmap

- [x] API endpoints for core entities
- [x] Excel upload and processing service (FlexibleExcelParser)
- [x] LLM agent for schema inference (SemanticETLAgent)
- [x] React frontend dashboard (V1)
- [ ] Real-time WebSocket updates (In-progress)
- [x] Background job processing (Celery + Redis)
- [ ] EU Digital Product Passport support

---

## 🤖 AI Developer Handbook

This codebase is optimized for AI-driven development. If you are an AI assistant working on this project, please follow these guidelines:

### 1. Service Layer Pattern
Always use the `ServiceResult` pattern for business logic. This ensures predictability and standardizes error handling.
```python
from app.core.service_result import ServiceResult

def my_service_method(...) -> ServiceResult[MyData]:
    # ... logic ...
    return ServiceResult.ok(data)
```

### 2. Type Safety & Enums
- Prefer using centralized enums from `app.core.types` to avoid circular dependencies.
- Always use Pydantic `Field(description="...")` to provide semantic context for the AI.

### 3. Semantic ETL
- When adding new column mappings, update `COLUMN_PATTERNS` in `app.services.excel.mappers`.
- Use the `decision_logs` in `ParseResult` to verify mapping logic.

### 4. Database Mutations
- Use the `GracefulDataIngester` for Excel imports to handle missing or fuzzy data consistently.
- Always prefer `async` database operations using SQLAlchemy 2.0 syntax.

### 5. Error Handling
- Use custom exceptions from `app.core.exceptions` for predictable error responses.
- All API errors follow the `ErrorResponse` schema with `detail`, `error_code`, and `context`.

---

## 📄 License

Proprietary - All Rights Reserved

---

Built with ❤️ for the apparel manufacturing industry
