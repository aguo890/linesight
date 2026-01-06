# LineSight 🏭

**AI-Driven Digital Transformation for SMB Apparel Manufacturing**

LineSight is a B2B SaaS platform that bridges the "digital divide" in apparel manufacturing. Using Large Language Models (LLMs) for Semantic ETL, LineSight parses messy Excel spreadsheets and delivers real-time analytics on SAM performance, DHU metrics, and workforce optimization—without requiring immediate behavioral changes from factory staff.

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
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Database** | MySQL 8.0+, SQLAlchemy 2.0 |
| **Migrations** | Alembic |
| **LLM Engine** | DeepSeek-V3 (primary), OpenAI GPT-4o (fallback) |
| **PII Protection** | Microsoft Presidio |
| **Containers** | Docker, Docker Compose |
| **Background Jobs** | Celery + Redis |

## 📁 Project Structure

```
FactoryExcelManager/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI endpoints
│   │   ├── core/          # Config, security, database
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic validation
│   │   └── services/      # Excel parser, LLM agent
│   ├── alembic/           # Database migrations
│   ├── Dockerfile         # Backend container
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile         # Frontend container
│   └── package.json
├── docker/
│   └── mysql/init.sql     # DB initialization
├── docker-compose.yml     # Full stack orchestration
└── README.md
```

## 🐳 Docker Quick Start (Recommended)

The fastest way to get LineSight running:

```bash
# Clone and enter directory
cd FactoryExcelManager

# Copy environment template
copy .env.docker.example .env

# Edit .env with your API keys
# - DEEPSEEK_API_KEY (required for LLM features)
# - SECRET_KEY (generate with: openssl rand -hex 32)

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend alembic upgrade head
```

**Services Available:**
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:5173
- MySQL: localhost:3306
- Redis: localhost:6379

## 💻 Local Development Setup

### Prerequisites

- Python 3.11+
- MySQL 8.0+
- Node.js 18+ (for frontend)

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
copy .env.example .env
# Edit .env with your MySQL credentials and API keys

# Create database
mysql -u root -p -e "CREATE DATABASE linesight CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

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

- [ ] API endpoints for all entities
- [x] Excel upload and processing service (FlexibleExcelParser)
- [x] LLM agent for schema inference (SemanticETLAgent)
- [ ] React frontend dashboard
- [ ] Real-time WebSocket updates
- [x] Background job processing (Celery config)
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
