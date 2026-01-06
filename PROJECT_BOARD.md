# 🏭 LineSight Project Board

> **Last Updated**: 2026-01-05  
> **Status**: Active Development  
> **Current Focus**: Technical Debt Cleanup & Dashboard Refinement
> **Note**: Some tasks may be outdated. Check git history for most recent status.

---

## 📊 Project Health Dashboard

| Metric | Status | Notes |
|--------|--------|-------|
| **Overall Progress** | 🟢 ~70% | Architecture transition active, Backend mature, Frontend catching up |
| **Backend API** | 🟢 ~85% | ELT, Matching, HITL, Prod Management APIs complete |
| **Frontend UI** | 🟢 ~60% | Dashboard Wizard, Dynamic Dashboard |
| **Core Services** | 🟢 ~90% | Hybrid Matching Engine, Excel Parser, LLM Agent |
| **Testing** | 🟡 ~60% | Comprehensive unit tests for services/API, need E2E |
| **Documentation** | 🟡 ~55% | README good, API docs good, Architecture specs detailed |

---

## 🎯 Current Sprint

### ✅ Completed This Sprint
- [x] Comprehensive codebase analysis for maintainability, scalability, and AI-friendliness
- [x] Refactor Excel Parser Service into modular components (`services/excel/`)
- [x] Optimize analytics endpoints with consolidated SQL queries (7→3 DB trips)
- [x] Implement decision logging for ETL transparency
- [x] Create centralized type registry (`app.core.types`)
- [x] Implement `ServiceResult` pattern for standardized service responses
- [x] Enhance schema metadata with rich `Field(description=...)` annotations
- [x] Add AI Developer Handbook to README
- [x] Fix header scoring logic to prevent over-matching short strings
- [x] **AI Decision Logging System** - Full transparency into AI schema inference and code generation
- [x] Create 6 complex Excel test files for parser validation
- [x] Test suite for AI decision logging (service + API layers)
- [x] **Automatic File Preview** - Immediate CSV/Excel preview modal upon upload
- [x] Backend Preview API (`/api/v1/uploads/preview/{id}`) with Pandas parsing
- [x] **Frontend Testing Infrastructure** - Vitest + React Testing Library + Playwright setup
- [x] Frontend unit tests for UI components (Button, Card, Input, FilePreviewModal)
- [x] Test utilities and mock data factories for frontend testing
- [x] **File Storage Segmentation** - Structured uploads (`/factory/line/year/month/`)
- [x] **System Reset Tool** - Endpoint (`DELETE /reset-state`) + Frontend Integration for full environment reset
- [x] **E2E Ingestion Flow** - Full connectivity from Upload -> Mapping -> Storage -> Dashboard


### 🔄 In Progress
- [/] Frontend unit tests - 8/10 passing (2 minor timing issues in FilePreviewModal)
- [ ] Frontend dashboard widget enhancements
- [ ] Database seeding utilities for development
- [ ] Implement Redis caching layer for dashboard stats
- [ ] Refactor DashboardWizard into smaller components
- [ ] Implement DashboardDataProvider to prevent waterfall fetching

### 📋 Up Next
- [ ] Complete frontend widget tests (6 widgets remaining)
- [ ] Frontend integration tests for API hooks and pages
- [ ] E2E tests with Playwright for critical user flows
- [ ] Frontend UI for AI Decision Timeline
- [ ] Expand unit test coverage for complex Excel files
- [ ] Implement dev-only endpoints for AI schema introspection
- [ ] AI decision feedback loop (user ratings)

---

## 🐛 Post-Debugging Action Items
> **Context**: Critical issues and refinements identified during data ingestion testing on 2026-01-03.

### 🚨 Backend / API (High Priority)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BUG-BE-01 | **Fix Efficiency Calculation (1700% Bug)**<br>Ensure `total_sam` query respects date range (Daily vs Cumulative) | P0 | M | ⬜ Todo | `getSamPerformance` |
| BUG-BE-02 | **Resolve Earned Minutes vs. SAM Discrepancy**<br>Align `dashboardApi` and `productionApi` logic | P0 | M | ⬜ Todo | `0` vs `65557` mismatch |
| BUG-BE-03 | **Fix Style Progress Data Mismatch**<br>Return Daily Actual vs Daily Target (not Cumulative) | P0 | M | ⬜ Todo | `getStyleProgress` |
| BUG-BE-04 | **Update Production Timeline Granularity**<br>Return objects with timestamps `{ time: "08:00", value: 10 }` | P1 | S | ⬜ Todo | `getHourlyProduction` |

### 🛠️ Frontend Refinements
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| REF-FE-01 | **Code Cleanup**<br>Remove debug logs (`console.group`) from `widgetDataService.ts` | P0 | S | ⬜ Todo | Tech debt |
| REF-FE-02 | **Fix DHU Quality Visualization**<br>Aggregate Categories or use new `getDhuBreakdown` endpoint | P1 | M | ⬜ Todo | Fix time-series mismatch |
| REF-FE-03 | **Real Data for Upload History**<br>Connect `fetchRealUploadHistory` to real API | P1 | M | ⬜ Todo | Replace mock data |
| REF-FE-04 | **Audit Widget Prop Passing**<br>Check `useWidgetData` props in all widgets (EarnedMinutes, Complexity, etc) | P0 | S | ⬜ Todo | Prevent silent mock fallback |
| REF-FE-05 | **Dynamic Bubble Sizes**<br>Map Complexity Widget `volume` to real data (planned/actual qty) | P2 | S | ⬜ Todo | Visual accuracy |

---

## 🏗️ Architectural & Technical Debt

### 🚨 Priority 1: Immediate (Backend Fixes)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-TECH-01 | **Centralize Metrics Logic to `AnalyticsService`**<br>Move all SUM/AVG logic from routes to dedicated service. | P0 | M | ✅ Done | [BE-001] |
| BE-TECH-02 | **Fix "The 1700% Bug" (Aggregation Scope)**<br>Respect `MAX(date)` or `SUM(daily_delta)` in queries. | P0 | M | ✅ Done | [BE-002] |

### 🚧 Priority 2: Short Term (Data Integrity)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| DATA-TECH-01 | **Implement "Physics Checks" in Excel Parser**<br>Flag Efficiency > 150% or Production > (Capacity * Max Speed). | P1 | M | ✅ Done | [DATA-001] |

### 🛠️ Priority 3: Mid Term (Frontend Refactor)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-TECH-01 | **Decouple `widgetDataService.ts`**<br>Split into domain adapters (Production, Quality, Workforce). | P2 | L | ⬜ Todo | [FE-001] |

### 🔭 Priority 4: Long Term (Scalability)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| ARCH-TECH-01 | **Migration to Materialized Views**<br>Create `daily_stats_snapshot` table for faster dashboard reads. | P3 | L | ⬜ Todo | [ARCH-001] |
| ARCH-TECH-02 | **Real-Time Strategy (SSE)**<br>Implement SSE for "File Upload Completed" notifications. | P3 | M | ⬜ Todo | [ARCH-002] |

---

## 📦 Feature Roadmap

### Phase 1: Core Platform ✅
- [x] FastAPI backend with async SQLAlchemy 2.0
- [x] MySQL database with Alembic migrations
- [x] JWT authentication & RBAC
- [x] React + TypeScript frontend with Vite
- [x] Flexible Excel parser with fuzzy matching
- [x] Optimized analytics endpoints
- [x] AI-friendly architecture (ServiceResult, centralized types, rich metadata)

### Phase 2: AI & ETL 🔄
- [x] Semantic ETL with LLM integration (DeepSeek-V3 + GPT-4o fallback)
- [x] Column pattern matching and data type inference
- [x] Decision logging for AI traceability
- [x] Modular Excel service (`detectors`, `mappers`, `ingesters`)
- [ ] AI-suggested widget configurations (See SV-040 to SV-043)
- [ ] Automated data quality scoring

### 🔐 Authentication & Authorization
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-001 | Implement JWT authentication endpoint `/auth/login` | P0 | M | ✅ Done | JWT working with demo user |
| BE-002 | Implement user registration `/auth/register` | P0 | M | ✅ Done | Creates org + user |
| BE-003 | Implement password reset flow | P2 | M | ⬜ Todo | Email integration needed |
| BE-004 | Add refresh token mechanism | P1 | S | ⬜ Todo | Extend session management |
| BE-005 | Implement RBAC middleware | P0 | L | ✅ Done | Admin/Manager/Analyst/Viewer roles |
| BE-006 | Implement Scoped Roles (Org/Factory/Line) | P0 | L | ⬜ Todo | Fine-grained access control |
| BE-007 | Semantic Mapping Layer API | P0 | L | ⬜ Todo | Store Excel-to-Internal mappings |

### 🏭 Factory & Organization Management
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-010 | CRUD endpoints for Organizations | P0 | M | ✅ Done | /organizations/me |
| BE-011 | CRUD endpoints for Factories | P0 | M | ✅ Done | Full CRUD + Soft Delete |
| BE-012 | CRUD endpoints for Production Lines | P0 | M | ✅ Done | Full CRUD implemented |
| BE-013 | Factory settings & configuration API | P2 | S | ⬜ Todo | Timezone, shifts, etc. |

### 📊 Production & Orders
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-020 | CRUD endpoints for Styles (garments) | P0 | M | ✅ Done | Tech pack, SAM, BOM |
| BE-021 | CRUD endpoints for Orders (POs) | P0 | M | ✅ Done | PO tracking system |
| BE-022 | CRUD endpoints for Production Runs | P0 | L | ✅ Done | Daily output logging |
| BE-023 | Production metrics aggregation API | P1 | L | ⬜ Todo | Real-time efficiency |
| BE-024 | Target vs Actual comparison API | P1 | M | ⬜ Todo | Dashboard charts |

### 👥 Workforce Management
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-030 | CRUD endpoints for Workers | P1 | M | ⬜ Todo | PII protection via Presidio |
| BE-031 | Worker skills matrix API | P1 | M | ⬜ Todo | Proficiency tracking |
| BE-032 | Attendance tracking API | P2 | M | ⬜ Todo | Shift management |
| BE-033 | Worker performance rankings | P1 | M | ⬜ Todo | Non-punitive metrics |

### 🔍 Quality Control
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-040 | Quality inspection CRUD | P1 | M | ⬜ Todo | In-line and end-line QC |
| BE-041 | Defects logging API | P1 | M | ⬜ Todo | Individual defect records |
| BE-042 | DHU (Defects per Hundred Units) calculation API | P0 | L | ⬜ Todo | Core KPI |
| BE-043 | Defect root cause analysis API | P2 | L | ⬜ Todo | LLM-powered insights |

### 📈 Analytics & Reporting
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-050 | Line efficiency metrics API | P0 | L | ⬜ Todo | SAM performance |
| BE-051 | Historical trends API | P1 | L | ⬜ Todo | Time-series data |
| BE-052 | Export to Excel/PDF API | P2 | M | ⬜ Todo | Report generation |
| BE-053 | Custom dashboard widgets API | P3 | L | ⬜ Todo | User-configurable |

### ✅ Compliance (UFLPA)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-060 | Traceability records CRUD | P1 | M | ⬜ Todo | Fabric origin tracking |
| BE-061 | Chain of custody API | P1 | L | ⬜ Todo | Full traceability |
| BE-062 | Compliance report generation | P2 | L | ⬜ Todo | UFLPA documentation |

### 📂 File Processing (Partially Complete ✅)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-070 | Excel upload endpoint | P0 | M | ✅ Done | Segregated storage implemented |
| BE-071 | Processing job status API | P0 | S | ⬜ Todo | Async job tracking |
| BE-072 | Parsed dataset retrieval API | P1 | M | ⬜ Todo | View ETL results |
| BE-073 | Column mapping override API | P2 | M | ⬜ Todo | User corrections |
| BE-076 | Ensure Upload History Accuracy | P0 | M | ⬜ Todo | Fix duplicates/stale data |

| BE-074 | Batch processing API | P2 | L | ⬜ Todo | Multiple files |
| BE-075 | File Preview API endpoint | P0 | S | ✅ Done | Parse & return first N rows |

### 🤖 AI Decision Logging (✅ Complete)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BE-080 | AIDecision model creation | P0 | M | ✅ Done | Tracks AI reasoning |
| BE-081 | Database migration for ai_decisions table | P0 | S | ✅ Done | Applied successfully |
| BE-082 | SemanticETLAgent logging integration | P0 | L | ✅ Done | Schema inference + code gen |
| BE-083 | AI decision API endpoints | P0 | M | ✅ Done | List, get, filter decisions |
| BE-084 | Confidence score calculation | P0 | S | ✅ Done | Average of column scores |
| BE-085 | Performance metadata tracking | P0 | S | ✅ Done | Tokens, latency, model |
| BE-086 | Test suite for AI decisions | P0 | L | ✅ Done | Service + API tests |
| BE-087 | Frontend AI Decision Timeline | P1 | L | ⬜ Todo | UI component |
| BE-088 | AI decision feedback loop | P2 | M | ⬜ Todo | User ratings |
| BE-089 | Cost analytics dashboard | P2 | M | ⬜ Todo | Token usage tracking |

---

## 📋 EPIC 2: Frontend UI/UX Development
> **Priority**: P0 (User-facing)  
> **Owner**: TBD  
> **Dependencies**: Backend API, Design System

### 🎨 Design System & Global Styles
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-001 | Implement Microsoft Office-style light theme | P0 | M | 🟡 In Progress | Per mockup_2.html |
| FE-002 | Update `index.css` - reduce base font to 14px | P0 | S | 🟡 In Progress | High-density design |
| FE-003 | Reduce default padding/margins by 50% | P0 | S | ⬜ Todo | Dense layout |
| FE-004 | Add monospace fonts for data/numbers | P1 | S | ⬜ Todo | Industrial feel |
| FE-005 | Implement color variables (MS Blue #0078d4) | P0 | S | ⬜ Todo | Brand consistency |
| FE-006 | Create shared Card component with Office styling | P1 | M | ⬜ Todo | Reusable |

### 🏠 Landing Page
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-010 | Redesign hero section - compact B2B style | P1 | M | ⬜ Todo | Not marketing billboard |
| FE-011 | Reduce heading sizes (text-7xl → text-2xl) | P0 | S | ⬜ Todo | Professional look |
| FE-012 | Compact features grid | P1 | M | ⬜ Todo | Dense information |
| FE-013 | Add product screenshots/mockups | P2 | M | ⬜ Todo | Show actual UI |

### 🔐 Login Page
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-020 | Implement compact centered card layout | P0 | M | ⬜ Todo | max-width: 400px |
| FE-021 | Reduce input heights (48px → 36px) | P0 | S | ⬜ Todo | Standard sizing |
| FE-022 | Remove/minimize marketing panel | P1 | S | ⬜ Todo | Reduce visual weight |
| FE-023 | Add remember me & forgot password | P2 | S | ⬜ Todo | Standard features |
| FE-024 | Integrate with `/auth/login` API | P0 | M | ⬜ Todo | Blocked on BE-001 |

### 📊 Dashboard (Main Focus)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-030 | Implement top navigation bar per mockup | P0 | M | 🟡 In Progress | Search, notifications |
| FE-031 | Implement left sidebar with nav sections | P0 | M | 🟡 In Progress | Core, Analytics groups |
| FE-032 | Add "AI Insight" card in sidebar | P1 | S | ⬜ Todo | Per mockup |
| FE-033 | Implement 4-column stats row | P0 | M | ⬜ Todo | Output, Efficiency, Discrepancies, Lines |
| FE-034 | Production vs Target chart (Chart.js) | P0 | L | ✅ Done | Visualizes daily output |
| FE-035 | Discrepancy table with AI analysis | P0 | L | ⬜ Todo | Core feature |
| FE-036 | Lowest performers widget | P1 | M | ⬜ Todo | Workforce ranking |
| FE-037 | Drag & drop Excel upload widget | P0 | M | ✅ Done | Auto-preview modal implemented |
| FE-038 | Connect all widgets to backend APIs | P0 | XL | 🟡 In Progress | Partially mapped to real data |
| FE-039 | Implement Widget Error Boundaries | P1 | S | ✅ Done | Alignment with Architecture Blueprint |
| FE-040 | Implement Dynamic Dashboard (RGL) | P0 | M | ✅ Done | Registry-based widget system |
| FE-041 | Dashboard Configuration Wizard | P0 | XL | 🟡 In Progress | Create/Update Split implemented |
| FE-041a | Implement Dashboard Edit Configuration | P0 | L | ⬜ Todo | Allow modifying widgets/layout |
| FE-042 | Sleek Semantic Mapping UI | P0 | L | ⬜ Todo | Visual, intuitive, drag-drop |
| FE-050 | `GenericChartWrapper` component | P1 | M | ⬜ Todo | Unified header/error handling |
| FE-051 | Implement `GenericBarChart` | P1 | M | ⬜ Todo | Config-driven visualization |
| FE-052 | Implement `GenericLineChart` | P1 | M | ⬜ Todo | Config-driven visualization |
| FE-053 | Implement `GenericKPIGrid` | P1 | M | ⬜ Todo | Config-driven stat cards |
| FE-054 | Integrate Suggestion API into Wizard | P0 | L | ⬜ Todo | Connect FE wizard to BE logic |
| FE-046 | Refactor DashboardWizard logic | P1 | L | ⬜ Todo | Extract hooks/steps |
| FE-047 | Implement DashboardDataProvider | P1 | M | ⬜ Todo | Fix waterfall fetching |
| FE-048 | Migrate Dashboard Storage to Backend | P2 | L | ⬜ Todo | Replace localStorage |
| FE-049 | Formalize Demo Mode Fallback | P2 | S | ⬜ Todo | Robust error handling |

### 📊 Dashboard Widgets (Existing - Need Refactor)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-040 | Refactor `LineEfficiencyGauge.tsx` - compact design | P1 | S | ⬜ Todo | Currently 437 bytes |
| FE-041 | Refactor `DhuQualityChart.tsx` - add data table | P1 | M | ⬜ Todo | More info density |
| FE-042 | Refactor `SamPerformanceMetric.tsx` | P1 | S | ⬜ Todo | Display actual SAM data |
| FE-043 | Refactor `ProductionTimeline.tsx` | P1 | M | ⬜ Todo | Gantt-style view? |
| FE-044 | Refactor `WorkforceAttendance.tsx` | P1 | M | ⬜ Todo | Attendance grid |
| FE-045 | Add dense mock data to all widgets | P0 | M | ⬜ Todo | More rows, not just 1 number |

### 📂 Data Import Feature
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-041 | Refactor `DhuQualityChart.tsx` - add data table | P1 | M | ⬜ Todo | More info density |
| FE-042 | Refactor `SamPerformanceMetric.tsx` | P1 | S | ⬜ Todo | Display actual SAM data |
| FE-043 | Refactor `ProductionTimeline.tsx` | P1 | M | ⬜ Todo | Gantt-style view? |
| FE-044 | Refactor `WorkforceAttendance.tsx` | P1 | M | ⬜ Todo | Attendance grid |
| FE-045 | Add lazy loading to widget registry | P1 | S | ✅ Done | Improved performance |

### ⚠️ Discrepancies Page
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-060 | Create Discrepancies list page | P0 | L | ⬜ Todo | Referenced in mockup |
| FE-061 | Discrepancy detail view | P1 | M | ⬜ Todo | Investigation workflow |
| FE-062 | Resolution workflow UI | P1 | L | ⬜ Todo | Mark as fixed |
| FE-063 | Badge count in sidebar | P0 | S | ⬜ Todo | Alert indicator |

### 👥 Workforce Page
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-070 | Create Workforce Ranking page | P1 | L | ⬜ Todo | In mockup sidebar |
| FE-071 | Worker list with efficiency metrics | P1 | M | ⬜ Todo | Sortable table |
| FE-072 | Skills matrix view | P2 | L | ⬜ Todo | Proficiency grid |
| FE-073 | Worker detail modal | P2 | M | ⬜ Todo | Individual stats |

### 🏭 Line Performance Page
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-080 | Create Line Performance page | P1 | L | ⬜ Todo | In mockup sidebar |
| FE-081 | Line comparison charts | P1 | L | ⬜ Todo | Multiple lines |
| FE-082 | Drill-down to individual line | P2 | M | ⬜ Todo | Detailed view |

### 📈 Reporting Feature
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| FE-090 | Create Reports page | P2 | L | ⬜ Todo | Scaffolded but empty |
| FE-091 | Report builder UI | P3 | XL | ⬜ Todo | Custom reports |
| FE-092 | Export options (PDF, Excel) | P2 | M | ⬜ Todo | Download |

---

## 📋 EPIC 3: Core Services & LLM Integration
> **Priority**: P0  
> **Status**: Partially Complete

### 📄 Excel Parser Service (✅ Mostly Complete)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SV-001 | FlexibleExcelParser implementation | P0 | XL | ✅ Done | 521 lines |
| SV-002 | Fuzzy column matching | P0 | L | ✅ Done | In excel_parser.py |
| SV-003 | Smart header detection | P0 | M | ✅ Done | Rows 1-20 |
| SV-004 | GracefulDataIngester | P0 | L | ✅ Done | Handles partial data |
| SV-005 | Add more column variations | P2 | S | ⬜ Todo | Expand mapping dict |
| SV-006 | Multi-sheet parsing | P2 | M | ⬜ Todo | Currently first sheet only |

### 🤖 LLM Agent Service (✅ Mostly Complete)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SV-010 | SemanticETLAgent implementation | P0 | XL | ✅ Done | 11KB |
| SV-011 | DeepSeek-V3 integration | P0 | L | ✅ Done | Primary LLM |
| SV-012 | OpenAI GPT-4o fallback | P0 | M | ✅ Done | Backup |
| SV-013 | Schema inference prompts | P0 | L | ✅ Done | Core logic |
| SV-014 | Discrepancy detection with AI | P1 | L | ⬜ Todo | Root cause analysis |
| SV-015 | AI-powered suggestions | P1 | L | ⬜ Todo | Mapping recommendations |

### 🧩 Dynamic Dashboard Engine (New Specification)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SV-040 | `DataProfiler` Service | P0 | M | ⬜ Todo | Extract cardinality, types, stats |
| SV-041 | `TemplateRegistry` System | P0 | M | ⬜ Todo | JSON-based widget definitions |
| SV-042 | `WidgetMatchMaker` Implementation | P0 | L | ⬜ Todo | Logic: Profile + Template = Config |
| SV-043 | Refactor `WidgetSuggestionService` | P0 | M | ⬜ Todo | Use new engine |

### 🔒 PII Protection (Presidio)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SV-020 | Integrate Presidio for PII redaction | P1 | L | ⬜ Todo | Before LLM processing |
| SV-021 | Define PII entities for factory data | P1 | M | ⬜ Todo | Worker names, IDs |
| SV-022 | De-anonymization for results | P2 | M | ⬜ Todo | After processing |

### ⚡ Background Jobs (Celery)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SV-030 | Celery configuration | P0 | M | 🟡 In Progress | docker-compose.yml has Redis |
| SV-031 | Excel processing async task | P0 | L | ⬜ Todo | Long-running jobs |
| SV-032 | Job status tracking | P1 | M | ⬜ Todo | Progress updates |
| SV-033 | Email notification tasks | P3 | M | ⬜ Todo | Alerts |

---

## 📋 EPIC 4: Infrastructure & DevOps
> **Priority**: P1  
> **Status**: Partially Complete

### 🐳 Docker & Containers (✅ Mostly Complete)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| IN-001 | Backend Dockerfile | P0 | S | ✅ Done | 1.6KB |
| IN-002 | Frontend Dockerfile | P0 | S | ✅ Done | 406 bytes |
| IN-003 | docker-compose.yml | P0 | M | ✅ Done | Full stack |
| IN-004 | MySQL initialization script | P0 | S | ✅ Done | docker/mysql/init.sql |
| IN-005 | Redis configuration | P1 | S | ✅ Done | For Celery |
| IN-006 | Production docker-compose | P2 | M | ⬜ Todo | Optimized for prod |
| IN-007 | Health check endpoints | P1 | S | ✅ Done | /health |

### 🗄️ Database & Migrations
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| IN-010 | Alembic setup | P0 | M | ✅ Done | alembic.ini exists |
| IN-011 | Initial migration (all models) | P0 | L | ✅ Done | All 25+ tables created |
| IN-012 | Seed data for development | P1 | M | ✅ Done | Demo user + org seeded |
| IN-013 | Database backup strategy | P2 | M | ⬜ Todo | Production prep |

### 🔄 CI/CD Pipeline
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| IN-020 | GitHub Actions: Backend tests | P1 | M | ⬜ Todo | pytest on push |
| IN-021 | GitHub Actions: Frontend tests | P1 | M | ⬜ Todo | Vitest on push |
| IN-022 | Docker image build on release | P2 | M | ⬜ Todo | Push to registry |
| IN-023 | Staging deployment pipeline | P2 | L | ⬜ Todo | Auto-deploy |
| IN-024 | Production deployment pipeline | P3 | L | ⬜ Todo | Manual approval |

### 📊 Monitoring & Logging
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| IN-030 | Structured logging setup | P1 | M | ✅ Done | app/core/logging.py |
| IN-031 | API request logging | P1 | S | ⬜ Todo | Middleware |
| IN-032 | Error tracking (Sentry?) | P2 | M | ⬜ Todo | Production monitoring |
| IN-033 | Metrics dashboard | P3 | L | ⬜ Todo | Grafana/Prometheus |

---

## 📋 EPIC 5: Testing & Quality Assurance
> **Priority**: P1  
> **Status**: 🔴 Needs Attention

### 🧪 Backend Tests
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| TS-001 | API endpoint tests - upload | P0 | M | ✅ Done | test_upload.py |
| TS-002 | API endpoint tests - auth | P0 | L | ⬜ Todo | Login, register |
| TS-003 | API endpoint tests - factory CRUD | P1 | L | ⬜ Todo | All endpoints |
| TS-004 | Service tests - excel_parser | P0 | M | ✅ Done | test_excel_parser.py |
| TS-005 | Service tests - llm_agent | P1 | L | ⬜ Todo | Mock LLM responses |
| TS-006 | Integration tests - full workflow | P1 | XL | ⬜ Todo | Upload → Parse → Store |
| TS-007 | Database fixture setup | P0 | M | ✅ Done | conftest.py |

### 🖥️ Frontend Tests
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| TS-010 | Component unit tests setup | P1 | M | ✅ Done | Vitest + React Testing Library + Playwright |
| TS-010a | Test utilities & mock factories | P1 | M | ✅ Done | Custom render, mock data |
| TS-010b | UI component tests (Button, Card, Input) | P1 | M | ✅ Done | 38 tests total |
| TS-010c | FilePreviewModal tests | P1 | M | 🟡 In Progress | 10/12 tests passing |
| TS-011 | Dashboard widget tests | P1 | L | ⬜ Todo | 6 widgets (LineEfficiency, DHU, etc) |
| TS-012 | Page component tests | P1 | L | ⬜ Todo | Landing, Login, Dashboard |
| TS-013 | Router tests | P2 | M | ⬜ Todo | Auth guards |
| TS-014 | API hook tests | P2 | M | ⬜ Todo | Mock responses |

### 🌐 E2E Tests
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| TS-020 | Playwright/Cypress setup | P2 | M | ✅ Done | Playwright config complete |
| TS-021 | Login flow E2E | P2 | M | ⬜ Todo | Auth journey |
| TS-022 | Excel upload E2E | P1 | L | ⬜ Todo | Core workflow |
| TS-023 | Dashboard interaction E2E | P2 | L | ⬜ Todo | Widget rendering |

---

## 📋 EPIC 6: Documentation
> **Priority**: P2  
> **Status**: Partial

### 📖 Developer Documentation
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| DC-001 | README.md | P0 | M | ✅ Done | 237 lines |
| DC-002 | API documentation (OpenAPI) | P0 | M | ✅ Done | Auto-generated |
| DC-003 | Database schema documentation | P1 | M | ⬜ Todo | ER diagram |
| DC-004 | Architecture decision records | P2 | L | ⬜ Todo | ADRs |
| DC-005 | Contributing guide | P2 | S | ⬜ Todo | CONTRIBUTING.md |
| DC-006 | Code style guide | P2 | S | ⬜ Todo | Linting rules |

### 📘 User Documentation
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| DC-010 | Getting started guide | P1 | L | ⬜ Todo | First-time users |
| DC-011 | Excel file requirements | P0 | M | ⬜ Todo | Supported formats |
| DC-012 | Feature walkthroughs | P2 | L | ⬜ Todo | With screenshots |
| DC-013 | FAQ | P3 | M | ⬜ Todo | Common questions |

---

## 📋 EPIC 7: Security & Compliance
> **Priority**: P1  
> **Status**: Needs Implementation

| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| SC-001 | JWT secret management | P0 | S | ✅ Done | Via .env file |
| SC-002 | Password hashing (bcrypt) | P0 | S | ✅ Done | bcrypt 4.0.1 working |
| SC-003 | SQL injection prevention | P0 | S | ✅ Done | SQLAlchemy ORM |
| SC-004 | XSS protection | P1 | S | ⬜ Todo | React default safe |
| SC-005 | CORS configuration review | P1 | S | ⬜ Todo | Restrict origins |
| SC-006 | Rate limiting | P2 | M | ⬜ Todo | API abuse prevention |
| SC-007 | Audit logging | P2 | L | ⬜ Todo | Who did what |
| SC-008 | Data encryption at rest | P3 | L | ⬜ Todo | Sensitive data |

---

## 📋 EPIC 8: LineSight Architecture Transition
> **Priority**: P0  
> **Status**: 🟢 Implementation Phase (Advanced)  
> **Reference**: [LineSight Architectural Blueprint](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/linesight_architecture.md)  
> **Implementation Plan**: [Detailed Plan](file:///C:/Users/19803/.gemini/antigravity/brain/471fb488-1f27-42f8-8029-820674ae46c5/implementation_plan.md)  
> **Timeline**: 6-7 weeks  
> **Est. LLM Cost**: ~$3.50/month (500 files @ ~10 ambiguous columns each)

### 🔄 Phase 1A: ELT Pipeline Foundation (Week 1-2)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Database Schema** |
| ELT-DB-01 | Create `RawImport` model | P0 | M | ✅ Done | Metadata + File Link |
| ELT-DB-02 | Create `StagingRecord` model (loose typing) | P0 | M | ✅ Done | Implemented via RawImport/Staging logic |
| ELT-DB-03 | Create `ODSASProductionRecord` model | P0 | L | ✅ Done | Production schema complete |
| ELT-DB-04 | Enhance `SchemaMapping` with waterfall metadata | P0 | M | ✅ Done | Added confidence, tier to schema |
| ELT-DB-05 | Create `AliasMapping` model for learning | P1 | M | ✅ Done | `app.models.alias_mapping` exists |
| ELT-DB-06 | Database migration script | P0 | S | ✅ Done | Alembic migrations applied |
| ELT-DB-07 | Backfill existing uploads to raw_imports | P1 | M | ⬜ Todo | Data migration script |
| **Services** |
| ELT-SV-01 | Implement `RawDataLoader` service | P0 | L | ✅ Done | Integrated into `ingestion.py` |
| ELT-SV-02 | Implement `DataProfiler` service | P0 | M | 🟡 Partial | Basic validation in `file_processor` |
| ELT-SV-03 | Implement `DataPromotionService` | P0 | L | ✅ Done | `FileProcessingService.promote` |
| **API Endpoints** |
| ELT-API-01 | `POST /api/v1/ingestion/process-raw/{id}` | P0 | M | ✅ Done | Full pipeline integration |
| ELT-API-02 | `POST /api/v1/ingestion/confirm-mapping` | P0 | M | ✅ Done | HITL confirmation logic |

### 🧠 Phase 1B: Hybrid Schema Matching Waterfall (Week 2-3)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Tier 1: Hash Matching** |
| **Tier 1: Hash Matching** |
| WF-T1-01 | Build in-memory alias cache (Redis) | P0 | M | 🟡 Partial | HashAliasMatcher (Postgres-based) |
| WF-T1-02 | Implement dynamic Pydantic `AliasGenerator` | P0 | L | ✅ Done | `HashAliasMatcher` logic |
| WF-T1-03 | Factory-scoped vs global alias resolution | P1 | M | ✅ Done | Implemented in `HashAliasMatcher` |
| **Tier 2: Fuzzy Matching** |
| WF-T2-01 | Install `rapidfuzz` library (C++ based) | P0 | S | ✅ Done | In requirements.txt |
| WF-T2-02 | Implement `RapidFuzzMatcher` service | P0 | M | ✅ Done | `services/matching/fuzzy_matcher.py` |
| WF-T2-03 | Build canonical terms dictionary | P0 | M | ✅ Done | `CANONICAL_ALIASES` in hash matcher |
| WF-T2-04 | Threshold tuning (85/100 cutoff) | P1 | S | ✅ Done | Tuned in production |
| **Tier 3: LLM Semantic** |
| WF-T3-01 | Enhance `SemanticETLAgent` with KERNEL prompts | P0 | L | ✅ Done | `LLMSemanticMatcher` implemented |
| WF-T3-02 | Add few-shot learning examples | P0 | M | ✅ Done | Included in system prompt |
| WF-T3-03 | Implement confidence scoring | P0 | M | ✅ Done | LLM returns confidence score |
| WF-T3-04 | Batch optimization (multi-column prompts) | P1 | M | ✅ Done | `match_batch` implemented |
| **Core Engine** |
| WF-EN-01 | Build `HybridMatchingEngine` orchestrator | P0 | XL | ✅ Done | Fully implemented |
| WF-EN-02 | Add performance instrumentation | P1 | S | 🟡 Partial | Basic timing logs added |
| WF-EN-03 | Unit tests for all 3 tiers | P0 | L | ✅ Done | `tests/test_matching_engine_new.py` |

### 🎨 Phase 2: Server-Driven UI (SDUI) (Week 3-5)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Backend Schema** |
| SDUI-DB-01 | Create `DashboardLayout` model | P0 | M | ⬜ Todo | JSON storage for SDUI schema |
| SDUI-DB-02 | Add role-based template support | P1 | M | ⬜ Todo | Manager/QC/Analyst views |
| SDUI-SC-01 | Define `SDUISchema` Pydantic model | P0 | M | ⬜ Todo | Layout + Components contract |
| SDUI-SC-02 | Add JSON schema validation | P0 | S | ⬜ Todo | Prevent malformed configs |
| **Backend API** |
| SDUI-API-01 | `GET /api/v1/sdui/layout/{id}` | P0 | M | ⬜ Todo | Serve SDUI JSON |
| SDUI-API-02 | `POST /api/v1/sdui/layout/{id}/customize` | P0 | M | ⬜ Todo | Save user drag-drop changes |
| SDUI-API-03 | Add Redis caching layer | P1 | M | ⬜ Todo | 1-hour TTL for layouts |
| SDUI-API-04 | Role-based widget injection | P1 | L | ⬜ Todo | Dynamic layout customization |
| **Frontend Core** |
| SDUI-FE-01 | Enhance component registry with lazy loading | P0 | M | 🟡 Partial | Already has registry.tsx |
| SDUI-FE-02 | Build `SDUIDashboard.tsx` component | P0 | L | ⬜ Todo | RGL integration |
| SDUI-FE-03 | Implement `GenericDataWidget` wrapper | P0 | M | ⬜ Todo | Data binding for all widgets |
| SDUI-FE-04 | Add `onLayoutChange` persistence | P0 | M | ⬜ Todo | Optimistic + remote sync |
| SDUI-FE-05 | LocalStorage offline fallback | P1 | S | ⬜ Todo | Offline-first UX |
| SDUI-FE-06 | Install DOMPurify for XSS protection | P0 | S | ⬜ Todo | Sanitize all SDUI props |
| **Widget Library** |
| SDUI-WG-01 | Convert `GaugeChart` to SDUI format | P0 | M | ⬜ Todo | Props-driven config |
| SDUI-WG-02 | Convert `TrendLine` to SDUI format | P0 | M | ⬜ Todo | Props-driven config |
| SDUI-WG-03 | Build 5 additional core widgets | P1 | L | ⬜ Todo | HeatMap, Table, Pie, etc. |

### 👤 Phase 3: Human-in-the-Loop (HITL) Interface (Week 5-6)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Mapping Review UI** |
| HITL-FE-01 | Build `MappingReviewModal.tsx` | P0 | L | ⬜ Todo | Side-by-side table |
| HITL-FE-02 | Implement confidence traffic lights | P0 | M | ⬜ Todo | Green/Yellow/Red indicators |
| HITL-FE-03 | Add data preview snippets (5 rows) | P0 | M | ⬜ Todo | Contextual sampling |
| HITL-FE-04 | Build `ConfidenceIndicator` component | P0 | S | ⬜ Todo | Reusable UI element |
| HITL-FE-05 | Add inline transformation tools | P2 | L | ⬜ Todo | Strip %, date parsing |
| HITL-FE-06 | Implement "Ignore Column" action | P1 | S | ⬜ Todo | Skip unmapped columns |
| **Quality Gates** |
| HITL-QG-01 | Build profiling report UI | P1 | M | ⬜ Todo | Summary stats display |
| HITL-QG-02 | Implement blocking logic for bad data | P1 | M | ⬜ Todo | >5% nulls = block |
| HITL-QG-03 | Add validation summary screen | P1 | M | ⬜ Todo | Pre-commit review |

### 🔁 Phase 4: Reinforcement Learning Loop (Week 6-7)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Backend Learning** |
| RL-SV-01 | Implement `AliasLearningService` | P0 | L | ✅ Done | Integrated in `ingestion` + `HashAliasMatcher` |
| RL-SV-02 | Add factory-scoped alias storage | P0 | M | ✅ Done | `AliasMapping` model supports scope |
| RL-SV-03 | Implement global promotion logic (>50 users) | P1 | M | ⬜ Todo | Global weighting |
| RL-SV-04 | Auto-refresh Pydantic aliases on promotion | P1 | M | 🟡 Partial | `load_aliases()` must be called |
| RL-SV-05 | Build LLM prompt refinement pipeline | P2 | L | ⬜ Todo | Add hard negatives to examples |
| **API Endpoints** |
| RL-API-01 | `POST /api/v1/feedback/alias-correction` | P0 | M | ✅ Done | Handled via `confirm-mapping` |
| RL-API-02 | `GET /api/v1/feedback/alias-stats` | P2 | S | ⬜ Todo | Analytics dashboard |

### 🧪 Phase 5: Testing & Verification (Week 7)
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| **Backend Tests** |
| TEST-BE-01 | Unit tests: Tier 1 hash matching | P0 | M | ⬜ Todo | <1ms benchmark |
| TEST-BE-02 | Unit tests: Tier 2 fuzzy matching | P0 | M | ⬜ Todo | RapidFuzz typo tolerance |
| TEST-BE-03 | Unit tests: Tier 3 LLM matching (mocked) | P0 | L | ⬜ Todo | Semantic disambiguation |
| TEST-BE-04 | Integration: ELT pipeline end-to-end | P0 | L | ⬜ Todo | Raw → Staging → Production |
| TEST-BE-05 | Integration: Alias learning workflow | P1 | M | ⬜ Todo | Correction → DB update |
| TEST-BE-06 | Performance: 100-column file < 30s | P0 | M | ⬜ Todo | Benchmarking script |
| **Frontend Tests** |
| TEST-FE-01 | Unit tests: `SDUIDashboard` rendering | P0 | M | ⬜ Todo | React Testing Library |
| TEST-FE-02 | Unit tests: `MappingReviewModal` | P0 | M | ⬜ Todo | User interactions |
| TEST-FE-03 | Unit tests: `ConfidenceIndicator` | P0 | S | ⬜ Todo | Color logic |
| TEST-FE-04 | E2E: Upload → HITL → Confirm → Dashboard | P0 | XL | ⬜ Todo | Playwright full flow |
| **Security Audit** |
| TEST-SEC-01 | XSS testing: SDUI prop injection | P0 | M | ⬜ Todo | DOMPurify validation |
| TEST-SEC-02 | LLM prompt injection testing | P0 | M | ⬜ Todo | Malicious column names |

### 📊 Success Metrics
| Metric | Current | Target | Test Method |
|--------|---------|--------|-------------|
| Column mapping accuracy | ~75% | >95% | User correction rate |
| Tier 1 coverage (hash) | 0% | 60% | Alias dictionary size |
| Tier 2 coverage (fuzzy) | ~50% | 30% | Fuzzy match logs |
| Tier 3 coverage (LLM) | ~50% | 10% | LLM invocation count |
| Avg processing time (50 cols) | ~45s | <30s | Performance benchmark |
| User corrections per file | N/A | <5 | HITL interaction logs |
| SDUI layout load time | N/A | <200ms | Redis cache hit rate |

---

## 📋 EPIC 9: Dashboard Assembly Animation
> **Priority**: P1  
> **Status**: Design Complete  
> **Reference**: [Fly-In Animation Spec](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/fly_in_animation_spec.md)

### 🎬 10-Phase Animation System
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| ANIM-001 | Create `AssemblyTransition.tsx` component | P0 | L | ⬜ Todo | Core animation orchestrator |
| ANIM-002 | Implement `useVirtualLayout()` hook | P0 | M | ⬜ Todo | Target projection before render |
| ANIM-003 | Add `data-widget-id` to Mini-Map blocks | P0 | S | ⬜ Todo | Origin coordinate capture |
| ANIM-004 | Create proxy card with glassmorphism | P1 | M | ⬜ Todo | Liquid Glass 2026 style |
| ANIM-005 | Implement staggered flight choreography | P0 | L | ⬜ Todo | Z-pattern, 35ms delay |
| ANIM-006 | Add spring physics landing (Framer Motion) | P0 | M | ⬜ Todo | Stiffness: 160, Damping: 14 |
| ANIM-007 | Implement Content Ignition (chart reveals) | P1 | L | ⬜ Todo | Sparkline draw, gauge sweep |
| ANIM-008 | Add Anomaly Badge glow animation | P1 | S | ⬜ Todo | Post-assembly signal |
| ANIM-009 | Implement Commitment Guard (lock UI) | P0 | S | ⬜ Todo | Prevent double-click |
| ANIM-010 | Add `prefers-reduced-motion` fallback | P0 | S | ⬜ Todo | Accessibility requirement |
| ANIM-011 | Implement localStorage recovery | P1 | M | ⬜ Todo | Crash resilience |
| ANIM-012 | Add viewport adaptation (<768px fade) | P1 | S | ⬜ Todo | Mobile graceful degradation |
| ANIM-013 | Performance testing (60fps target) | P0 | M | ⬜ Todo | Chrome DevTools validation |

---

## 📋 EPIC 10: Live Data Layer
> **Priority**: P1  
> **Status**: Design Complete  
> **Reference**: [Live Data Architecture Spec](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/live_data_architecture_spec.md)

### 📡 WebSocket Pub/Sub Layer
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| LIVE-001 | Create `useLiveSocket` hook | P0 | L | ⬜ Todo | Topic-based subscription |
| LIVE-002 | Implement heartbeat monitor (5s) | P0 | M | ⬜ Todo | Bidirectional ping/pong |
| LIVE-003 | Add sequence number tracking | P0 | M | ⬜ Todo | Delta integrity check |
| LIVE-004 | Build reconnection state machine | P0 | L | ⬜ Todo | Exponential backoff |
| LIVE-005 | Add connection status UI (Live pill) | P1 | S | ⬜ Todo | Green/Yellow/Red indicator |
| LIVE-006 | Add `visibilitychange` pause/resume | P1 | S | ⬜ Todo | Battery optimization |

### �️ Zustand Store Structure (Central Nervous System)
> **Location:** `frontend/src/store/machine/`

| ID | Task | File | Priority | Effort | Status | Notes |
|-------|------|------|----------|--------|--------|-------|
| LIVE-ST-01 | Define shared interfaces | `types.ts` | P0 | M | ⬜ Todo | MachineState, Lock, Transaction, ParsedBatch |
| LIVE-ST-02 | Implement server slice | `serverSlice.ts` | P0 | M | ⬜ Todo | applySnapshot, applyDelta, seqTracking |
| LIVE-ST-03 | Implement pending slice | `pendingSlice.ts` | P0 | L | ⬜ Todo | beginTx, applyOptimistic, confirmTx, failTx |
| LIVE-ST-04 | Build merge selectors | `selectors.ts` | P0 | M | ⬜ Todo | useMachineView, useLineView |
| LIVE-ST-05 | Create store barrel export | `index.ts` | P0 | S | ⬜ Todo | Combine slices, export hooks |

### �🔄 Optimistic UI Layer
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| LIVE-007 | Create Zustand three-tier store | P0 | L | ⬜ Todo | $server/$pending/$view |
| LIVE-008 | Implement field-level lock manager | P0 | M | ⬜ Todo | Prevent WS clobbering |
| LIVE-009 | Build memoized merge selector | P0 | M | ⬜ Todo | Performance critical |
| LIVE-010 | Add transaction batching (Excel) | P1 | M | ⬜ Todo | Bulk upload support |
| LIVE-011 | Implement safety bypass (E-Stop) | P0 | S | ⬜ Todo | Critical overrides |
| LIVE-012 | Add 10s lock timeout + warning | P1 | S | ⬜ Todo | Prevent stale optimism |
| LIVE-013 | Build conflict detection UI | P1 | M | ⬜ Todo | "Updated by another operator" |
| LIVE-014 | Visual feedback components | P1 | M | ⬜ Todo | Blue/Green/Red states |

### 📤 Data Ingestion Layer (Excel Parser)
| ID | Task | Priority | Effort | Status | Notes |
|-------|------|----------|--------|--------|-------|
| LIVE-DI-01 | Create ExcelParserWorker | P0 | L | ⬜ Todo | Web Worker for >50KB files |
| LIVE-DI-02 | SheetJS + header validation | P0 | M | ⬜ Todo | Machine ID, Target Speed required |
| LIVE-DI-03 | Zod BatchUploadSchema | P0 | M | ⬜ Todo | machineId, targetSpeed, mode |
| LIVE-DI-04 | Type coercion + warnings | P1 | M | ⬜ Todo | "100" → 100, log warnings |
| LIVE-DI-05 | Machine ID $server check | P0 | S | ⬜ Todo | Validate IDs exist |
| LIVE-DI-06 | Chunked processing (>1000 rows) | P1 | M | ⬜ Todo | 500-row batches for GC |
| LIVE-DI-07 | ParsedBatch transformer | P0 | M | ⬜ Todo | Output contract for $pending |

### 🧪 Integration Tests
| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| LIVE-015 | Test E-Stop bypass scenario | P0 | M | ⬜ Todo | Safety critical |
| LIVE-016 | Test upload timeout scenario | P1 | M | ⬜ Todo | Edge case |
| LIVE-017 | Test concurrent operator conflict | P1 | L | ⬜ Todo | Multi-user scenario |

---

## 🏷️ Priority Legend

| Priority | Meaning | Action |
|----------|---------|--------|
| **P0** | Critical/Blocker | Must complete this sprint |
| **P1** | High | Complete next sprint |
| **P2** | Medium | Backlog - plan soon |
| **P3** | Low | Nice to have |

## 📏 Effort Legend

| Size | Meaning | Time Estimate |
|------|---------|---------------|
| **S** | Small | < 2 hours |
| **M** | Medium | 2-8 hours |
| **L** | Large | 1-3 days |
| **XL** | Extra Large | 3-5 days |

## 📊 Status Legend

| Icon | Status |
|------|--------|
| ⬜ | Todo |
| 🟡 | In Progress |
| ✅ | Done |
| 🚫 | Blocked |
| ❌ | Won't Do |

---

## 🔄 Change Log

| Date | Change | Author |
|------|--------|--------|
| 2024-12-24 | Initial project board creation | Claude |
| 2024-12-25 | Auth endpoints (BE-001, BE-002), DB migration (IN-011), Demo seeding (IN-012), bcrypt fix (SC-002), Error handling improvements | Claude |
| 2024-12-25 | Factory & Organization CRUD (BE-010, BE-011, BE-012) implemented and tested | Claude |
| 2024-12-25 | Excel Upload Widget (FE-037) implemented | Claude |
| 2024-12-25 | Production CRUD (BE-020, BE-021, BE-022) implemented | Claude |
| 2024-12-25 | Production Chart (FE-034) connected to real data | Claude |
| 2024-12-25 | Dynamic Dashboard Enhancement: Error Boundaries & Lazy Loading | Antigravity |
| 2024-12-25 | Multiple Dashboard Management & Sample Data created | Antigravity |
| 2024-12-25 | Environment config added to backend (IN-030) | User |
| 2024-12-25 | Codebase Analysis: Maintainability, Scalability, AI-Friendliness | Antigravity |
| 2024-12-25 | Excel Parser Refactoring: Modular services/excel/ package | Antigravity |
| 2024-12-25 | Analytics Optimization: Consolidated queries (7→3 DB trips) | Antigravity |
| 2024-12-25 | AI Context Enhancements: ServiceResult, types.py, rich metadata | Antigravity |
| 2024-12-25 | **AI Decision Logging System**: Full transparency into schema inference and code generation (BE-080 to BE-086) | Antigravity |

| 2024-12-25 | Created 6 complex Excel test files for parser validation | Antigravity |
| 2024-12-25 | Comprehensive test suite for AI decision logging (service + API layers) | Antigravity |
| 2024-12-25 | **Automatic File Preview Feature**: Backend API + Frontend Modal (BE-075, FE-037 enhanced) | Antigravity |
| 2024-12-25 | **Frontend Testing Infrastructure**: Vitest + Playwright setup, UI component tests (TS-010, TS-010a, TS-010b, TS-010c, TS-020) | Antigravity |
| 2024-12-27 | **LineSight Architecture Implementation Plan**: Comprehensive technical breakdown with 80+ tasks across 5 phases (ELT Pipeline, Hybrid Matching, SDUI, HITL, Learning Loop). 6-7 week timeline. | Antigravity |
| 2024-12-27 | **Storage Segmentation & System Reset**: Implemented hierarchical file storage, added `production_line` context to uploads, and created a "Nuclear Reset" feature for dev environment (Backend + Frontend). | Antigravity |
| 2024-12-27 | **Dashboard Wizard Decoupling**: Split Create and Upload flows. Implemented `createFactory`/`createLine` frontend APIs. Users can now define new contexts during dashboard creation. | Antigravity |
| 2026-01-03 | **Dashboard Assembly Animation Spec**: 10-phase fly-in animation design (spatial continuity, spring physics, accessibility). Added EPIC 9. | Antigravity |
| 2026-01-03 | **Live Data Architecture Spec**: WebSocket pub/sub + Optimistic UI with three-tier state. Added EPIC 10. | Antigravity |

---

## 📎 Quick Links

- [README](file:///c:/Users/19803/business/FactoryExcelManager/README.md) - Project overview
- [Mockup v2](file:///c:/Users/19803/business/FactoryExcelManager/mockup_2.html) - Target UI design
- [LineSight Architecture](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/linesight_architecture.md) - Technical Blueprint
- **[Fly-In Animation Spec](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/fly_in_animation_spec.md)** - Dashboard assembly animation (10-phase)
- **[Live Data Architecture](file:///c:/Users/19803/business/FactoryExcelManager/docs/specs/live_data_architecture_spec.md)** - WebSocket + Optimistic UI
- [LineSight Implementation Plan](file:///C:/Users/19803/.gemini/antigravity/brain/471fb488-1f27-42f8-8029-820674ae46c5/implementation_plan.md) - Detailed execution roadmap
- [UI Refactor Guide](file:///c:/Users/19803/business/FactoryExcelManager/prompt_for_next_chat.md) - Design requirements
- [API Docs](http://localhost:8000/docs) - Swagger UI (when running)
