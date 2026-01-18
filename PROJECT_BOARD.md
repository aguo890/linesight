# 🏭 LineSight Project Board

> **Last Updated**: 2026-01-18
> **Status**: Active Development
> **Current Focus**: Frontend Testing & UI Polish
> **Note**: PostgreSQL migration complete ✅ | Ingestion reliability implemented ✅

---

## 📊 Project Health Dashboard

| Metric | Status | Notes |
|--------|--------|-------|
| **Overall Progress** | 🟢 ~75% | Architecture transition active, Backend mature, Frontend catching up |
| **Backend API** | 🟢 ~92% | ELT, Matching, HITL, Prod Management APIs complete |
| **Frontend UI** | 🟢 ~65% | Dashboard Wizard, Dynamic Dashboard, Store foundation |
| **Core Services** | 🟢 ~90% | Hybrid Matching Engine, Excel Parser, LLM Agent |
| **Testing** | 🟡 ~60% | Comprehensive unit tests for services/API, need E2E |
| **Documentation** | 🟡 ~55% | README good, API docs good, Architecture specs detailed |

---

## 🚨 Critical Priorities & Blockers (P0)

### 🛡️ Data Integrity & Visualization (P0 - IMMEDIATE FOCUS)
> **Goal**: Ensure data is persistently available, automatically linked to lines, and correctly visualized.

| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| DATA-001 | **Auto-Link Line Name** | P0 | M | ⬜ Todo | Extract "Line Name" from Excel content during upload |
| DATA-002 | **Fix Malformed Widget Data** | P0 | M | ⬜ Todo | Add `line_id` synonym to `ProductionRun` model |
| DATA-003 | **Verify Data Persistence** | P0 | S | ⬜ Todo | Test historical data availability |

### 💀 Technical Debt: Missing Test Coverage (P0)
> **⚠️ Warning:** These features exist in code but have NO test files.
> *Identified by V2 Code-First Reconciler on 2026-01-17*

| Priority | Area | Gap | Target Files |
|----------|------|-----|--------------|
| **P0** | Frontend | Widget tests (6 widgets) | `widgets/*.test.tsx` |
| **P0** | Frontend | Integration tests for API hooks | `hooks/*.test.tsx` |
| **P0** | E2E | Playwright critical flows | `e2e/*.spec.ts` |
| **P1** | Backend | AI Decision endpoint tests | `test_ai_decisions.py` |
| **P1** | Backend | WebSocket endpoint tests | `test_websockets.py` |
| **P1** | Backend | Excel ingestion module tests | `test_ingestion.py` |
| **P2** | Backend | Waitlist service tests | `test_waitlist.py` |

### 🐛 Critical Bug Fixes (Post-Debugging)
> **Context**: Critical issues identified during data ingestion testing.

| ID | Task | Priority | Effort | Status | Notes |
|----|------|----------|--------|--------|-------|
| BUG-BE-01 | **Fix Efficiency Calculation (1700% Bug)**<br>Ensure `total_sam` query respects date range (Daily vs Cumulative) | P0 | M | ⬜ Todo | `getSamPerformance` |
| BUG-BE-02 | **Resolve Earned Minutes vs. SAM Discrepancy**<br>Align `dashboardApi` and `productionApi` logic | P0 | M | ⬜ Todo | `0` vs `65557` mismatch |
| BUG-BE-03 | **Fix Style Progress Data Mismatch**<br>Return Daily Actual vs Daily Target (not Cumulative) | P0 | M | ⬜ Todo | `getStyleProgress` |
| REF-FE-01 | **Code Cleanup**<br>Remove debug logs (`console.group`) from `widgetDataService.ts` | P0 | S | ⬜ Todo | Tech debt |
| REF-FE-04 | **Audit Widget Prop Passing**<br>Check `useWidgetData` props in all widgets (EarnedMinutes, Complexity, etc) | P0 | S | ⬜ Todo | Prevent silent mock fallback |
| REF-BE-01 | **Modularize `analytics.py`**<br>Break up monolithic analytics module into smaller, focused modules | P1 | M | ⬜ Todo | Improve maintainability |

### 📊 Analytics & API Refactoring (2026-01-18)
> **Context**: Endpoint refactoring causing breaking changes.

| Change | Old Endpoint | New Endpoint | Notes |
|--------|--------------|--------------|-------|
| DHU Quality | `/quality/dhu` | `/dhu` | Simplified path |
| Speed vs Quality | `/speed-vs-quality` | `/speed-quality` | Simplified path |
| Complexity Analysis | - | Added `line_id` param | New required parameter |
| Error Handling | - | Improved | Better debug logging for production writers |

---

## 🔄 Active Development (In Progress)

### 🏃 Current Sprint Focus
- [ ] Sub-Task 2a: Add `line_id` synonym to `ProductionRun` model
- [ ] Sub-Task 2b: Implement smart date inference logic
- [ ] Sub-Task 2c: Implement PO safety (UNKNOWN_PO_{hash})
- [ ] Frontend unit tests - 8/10 passing (2 minor timing issues in FilePreviewModal)
- [ ] Frontend UI for AI Decision Timeline
- [ ] Implement dev-only endpoints for AI schema introspection
- [ ] AI decision feedback loop (user ratings)

### 🏗️ EPIC 8: LineSight Architecture Transition (Implementation Phase)
> **Timeline**: 6-7 weeks | **Est. LLM Cost**: ~$3.50/month

**Phase 1A: ELT Pipeline Foundation**
- [ ] ELT-DB-07: Backfill existing uploads to raw_imports (Data migration script)
- [ ] ELT-SV-02: Implement `DataProfiler` service (Partial)

**Phase 1B: Hybrid Schema Matching Waterfall**
- [ ] WF-T1-01: Build in-memory alias cache (Redis) (Partial)
- [ ] WF-EN-02: Add performance instrumentation (Partial)

**Phase 2: Server-Driven UI (SDUI)**
- [ ] SDUI-DB-01: Create `DashboardLayout` model
- [ ] SDUI-DB-02: Add role-based template support
- [ ] SDUI-SC-01: Define `SDUISchema` Pydantic model
- [ ] SDUI-SC-02: Add JSON schema validation
- [ ] SDUI-API-01: `GET /api/v1/sdui/layout/{id}`
- [ ] SDUI-API-02: `POST /api/v1/sdui/layout/{id}/customize`
- [ ] SDUI-API-03: Add Redis caching layer
- [ ] SDUI-API-04: Role-based widget injection
- [ ] SDUI-FE-01: Enhance component registry with lazy loading (Partial)
- [ ] SDUI-FE-02: Build `SDUIDashboard.tsx` component
- [ ] SDUI-FE-03: Implement `GenericDataWidget` wrapper
- [ ] SDUI-FE-04: Add `onLayoutChange` persistence
- [ ] SDUI-FE-05: LocalStorage offline fallback
- [ ] SDUI-FE-06: Install DOMPurify for XSS protection
- [ ] SDUI-WG-01: Convert `GaugeChart` to SDUI format
- [ ] SDUI-WG-02: Convert `TrendLine` to SDUI format
- [ ] SDUI-WG-03: Build 5 additional core widgets

### 🎨 EPIC 11: Semantic Theme & Dark Mode (In Progress)
- [ ] DARK-003: Component audit & class replacement (Shell migrated)
- [ ] DARK-004: Verify visual parity (Light mode)
- [ ] DARK-014: Refine Glassmorphism for Dark Mode

---

## 📋 Feature Backlog (Future & Remaining Debt)

### 🛠️ Remaining Frontend UI/UX (EPIC 2)
> **Priority**: P0 (User-facing)

**Design & Landing**
- [ ] FE-003: Reduce default padding/margins by 50%
- [ ] FE-004: Add monospace fonts for data/numbers
- [ ] FE-005: Implement color variables (MS Blue #0078d4)
- [ ] FE-006: Create shared Card component with Office styling
- [ ] FE-010: Redesign hero section - compact B2B style
- [ ] FE-011: Reduce heading sizes (text-7xl → text-2xl)
- [ ] FE-012: Compact features grid
- [ ] FE-013: Add product screenshots/mockups

**Dashboard Implementation**
- [ ] FE-032: Add "AI Insight" card in sidebar
- [ ] FE-033: Implement 4-column stats row
- [ ] FE-035: Discrepancy table with AI analysis
- [ ] FE-036: Lowest performers widget
- [ ] FE-038: Connect all widgets to backend APIs (In Progress)
- [ ] FE-041: Dashboard Configuration Wizard (In Progress)
- [ ] FE-041a: Implement Dashboard Edit Configuration
- [ ] FE-042: Sleek Semantic Mapping UI
- [ ] FE-050: `GenericChartWrapper` component
- [ ] FE-051: Implement `GenericBarChart`
- [ ] FE-052: Implement `GenericLineChart`
- [ ] FE-053: Implement `GenericKPIGrid`
- [ ] FE-054: Integrate Suggestion API into Wizard
- [ ] FE-046: Refactor DashboardWizard logic
- [ ] FE-047: Implement DashboardDataProvider
- [ ] FE-048: Migrate Dashboard Storage to Backend
- [ ] FE-049: Formalize Demo Mode Fallback

**Widget Refactoring**
- [ ] FE-040: Refactor `LineEfficiencyGauge.tsx` - compact design
- [ ] FE-041: Refactor `DhuQualityChart.tsx` - add data table
- [ ] FE-042: Refactor `SamPerformanceMetric.tsx`
- [ ] FE-043: Refactor `ProductionTimeline.tsx`
- [ ] FE-044: Refactor `WorkforceAttendance.tsx`
- [ ] FE-045: Add dense mock data to all widgets

**New Pages**
- [ ] FE-060: Create Discrepancies list page
- [ ] FE-061: Discrepancy detail view
- [ ] FE-062: Resolution workflow UI
- [ ] FE-063: Badge count in sidebar
- [ ] FE-070: Create Workforce Ranking page
- [ ] FE-071: Worker list with efficiency metrics
- [ ] FE-072: Skills matrix view
- [ ] FE-073: Worker detail modal
- [ ] FE-080: Create Line Performance page
- [ ] FE-081: Line comparison charts
- [ ] FE-082: Drill-down to individual line
- [ ] FE-090: Create Reports page
- [ ] FE-091: Report builder UI
- [ ] FE-092: Export options (PDF, Excel)

### 🛡️ RBAC & Security (Remaining)
- [ ] BE-003: Implement password reset flow
- [ ] BE-004: Add refresh token mechanism
- [ ] BE-007: Semantic Mapping Layer API
- [ ] BE-013: Factory settings & configuration API
- [ ] SC-004: XSS protection
- [ ] SC-005: CORS configuration review
- [ ] SC-006: Rate limiting
- [ ] SC-007: Audit logging
- [ ] SC-008: Data encryption at rest
- [ ] RBAC-001: Owner can view all users in their organization
- [ ] RBAC-002: Owner can assign managers to specific lines
- [ ] RBAC-003: Owner can revoke manager line access
- [ ] RBAC-004: UI for line assignment (Owner view)
- [ ] RBAC-005: Manager can only see users they manage (same lines)
- [ ] RBAC-010: Manager can only upload to assigned lines
- [ ] RBAC-011: Manager can only promote data to assigned lines
- [ ] RBAC-012: Filter upload history by assigned lines
- [ ] RBAC-020: Filter analytics endpoints by user scope
- [ ] RBAC-021: Dashboard widgets respect line scope
- [ ] RBAC-022: Manager cannot create dashboards org-wide
- [ ] RBAC-030: Restrict line creation to OWNER role
- [ ] RBAC-031: Restrict line deletion to OWNER role
- [ ] RBAC-032: Manager cannot modify line settings
- [ ] RBAC-040: SYSTEM_ADMIN can view all organizations
- [ ] RBAC-041: SYSTEM_ADMIN can impersonate users
- [ ] RBAC-042: SYSTEM_ADMIN can reset user passwords
- [ ] RBAC-050: Hide "Create Line" button for Managers
- [ ] RBAC-051: Show only assigned lines in sidebar/nav
- [ ] RBAC-052: Role-based menu items (Owner vs Manager)
- [ ] RBAC-053: User management page (Owner only)

### 🏭 Core Domain Features (Remaining)
- [ ] BE-023: Production metrics aggregation API
- [ ] BE-024: Target vs Actual comparison API
- [ ] BE-030: CRUD endpoints for Workers
- [ ] BE-031: Worker skills matrix API
- [ ] BE-032: Attendance tracking API
- [ ] BE-033: Worker performance rankings
- [ ] BE-040: Quality inspection CRUD
- [ ] BE-041: Defects logging API
- [ ] BE-042: DHU (Defects per Hundred Units) calculation API
- [ ] BE-043: Defect root cause analysis API
- [ ] BE-050: Line efficiency metrics API
- [ ] BE-051: Historical trends API
- [ ] BE-052: Export to Excel/PDF API
- [ ] BE-053: Custom dashboard widgets API
- [ ] BE-060: Traceability records CRUD
- [ ] BE-061: Chain of custody API
- [ ] BE-062: Compliance report generation

### 🧩 Core Services & AI (Epic 3 Remaining)
- [ ] SV-005: Add more column variations
- [ ] SV-006: Multi-sheet parsing
- [ ] SV-014: Discrepancy detection with AI
- [ ] SV-015: AI-powered suggestions
- [ ] SV-040: `DataProfiler` Service
- [ ] SV-041: `TemplateRegistry` System
- [ ] SV-042: `WidgetMatchMaker` Implementation
- [ ] SV-043: Refactor `WidgetSuggestionService`
- [ ] SV-020: Integrate Presidio for PII redaction
- [ ] SV-021: Define PII entities for factory data
- [ ] SV-022: De-anonymization for results
- [ ] SV-031: Excel processing async task
- [ ] SV-032: Job status tracking
- [ ] SV-033: Email notification tasks
- [ ] BE-087: Frontend AI Decision Timeline
- [ ] BE-088: AI decision feedback loop
- [ ] BE-089: Cost analytics dashboard

### 🚀 Infrastructure & Testing (Epics 4 & 5)
- [ ] IN-006: Production docker-compose
- [ ] IN-013: Database backup strategy
- [ ] IN-020: GitHub Actions: Backend tests
- [ ] IN-021: GitHub Actions: Frontend tests
- [ ] IN-022: Docker image build on release
- [ ] IN-023: Staging deployment pipeline
- [ ] IN-024: Production deployment pipeline
- [ ] IN-031: API request logging
- [ ] IN-032: Error tracking (Sentry?)
- [ ] IN-033: Metrics dashboard
- [ ] TS-002: API endpoint tests - auth
- [ ] TS-003: API endpoint tests - factory CRUD
- [ ] TS-005: Service tests - llm_agent
- [ ] TS-006: Integration tests - full workflow
- [ ] TS-011: Dashboard widget tests
- [ ] TS-012: Page component tests
- [ ] TS-013: Router tests
- [ ] TS-014: API hook tests
- [ ] TS-021: Login flow E2E
- [ ] TS-022: Excel upload E2E
- [ ] TS-023: Dashboard interaction E2E

### 📡 New Architectures (Epics 9 & 10)
**Animation System (Epic 9)**
- [ ] ANIM-001: Create `AssemblyTransition.tsx` component
- [ ] ANIM-002 to ANIM-013 (Full spec in backlog)

**Live Data Layer (Epic 10)**
- [ ] LIVE-001: Create `useLiveSocket` hook
- [ ] LIVE-002 to LIVE-017 (Full spec in backlog)

---

## ✅ Completed / Archive

### 🏆 Recently Completed
- [x] **Phase 1: PostgreSQL Migration (P0 BLOCKER)**
- [x] **Phase 2: Ingestion Reliability**
- [x] **AI Decision Logging System** (Full Traceability)
- [x] **Frontend Testing Infrastructure** (Vitest + Playwright)
- [x] **File Storage Segmentation**
- [x] **System Reset Tool**
- [x] **E2E Ingestion Flow**
- [x] Comprehensive codebase analysis
- [x] Refactor Excel Parser Service
- [x] Optimize analytics endpoints
- [x] Implement decision logging for ETL transparency
- [x] Create centralized type registry
- [x] Implement `ServiceResult` pattern
- [x] Enhance schema metadata
- [x] Add AI Developer Handbook to README
- [x] Fix header scoring logic
- [x] Create 6 complex Excel test files
- [x] Test suite for AI decision logging
- [x] Automatic File Preview
- [x] Backend Preview API
- [x] Frontend unit tests for UI components

### 👻 Ghost Work (Reconciled & Detected)
- [x] UI/UX: Toast notification system
- [x] UI/UX: Manual popover positioning
- [x] Settings: User preferences safe sync
- [x] Localization: RTL support, Multi-language (8 langs)
- [x] Testing: Profile page tests
- [x] Waitlist Feature with Backend API
- [x] Dark Mode Support
- [x] Docker-first PostgreSQL Architecture
- [x] Factory-based Data Structure
- [x] Excel Parser with Smart Matching
- [x] WebSocket Support
- [x] Production Line Management
- [x] Data Quality Monitoring
- [x] Dashboard Widget System

### ✅ Completed Architecture Tasks (LineSight)
- [x] ELT-DB-01: Create `RawImport` model
- [x] ELT-DB-02: Create `StagingRecord` model
- [x] ELT-DB-03: Create `ODSASProductionRecord` model
- [x] ELT-DB-04: Enhance `SchemaMapping`
- [x] ELT-DB-05: Create `AliasMapping` model
- [x] ELT-DB-06: Database migration script
- [x] ELT-SV-01: Implement `RawDataLoader` service
- [x] ELT-SV-03: Implement `DataPromotionService`
- [x] ELT-API-01: `POST /api/v1/ingestion/process-raw/{id}`
- [x] ELT-API-02: `POST /api/v1/ingestion/confirm-mapping`
- [x] WF-T1-02: Implement dynamic Pydantic `AliasGenerator`
- [x] WF-T1-03: Factory-scoped vs global alias resolution
- [x] WF-T2-01: Install `rapidfuzz` library
- [x] WF-T2-02: Implement `RapidFuzzMatcher` service
- [x] WF-T2-03: Build canonical terms dictionary
- [x] WF-T2-04: Threshold tuning
- [x] WF-T3-01: Enhance `SemanticETLAgent` with KERNEL prompts
- [x] WF-T3-02: Add few-shot learning examples
- [x] WF-T3-03: Implement confidence scoring
- [x] WF-T3-04: Batch optimization
- [x] WF-EN-01: Build `HybridMatchingEngine` orchestrator
- [x] WF-EN-03: Unit tests for all 3 tiers
- [x] RL-SV-01: Implement `AliasLearningService`
- [x] RL-SV-02: Add factory-scoped alias storage
- [x] RL-API-01: `POST /api/v1/feedback/alias-correction`

### ✅ Completed Core Features
- [x] FastAPI backend with async SQLAlchemy 2.0
- [x] MySQL database with Alembic migrations
- [x] JWT authentication & RBAC
- [x] React + TypeScript frontend with Vite
- [x] Flexible Excel parser with fuzzy matching
- [x] Optimized analytics endpoints
- [x] BE-001: Implement JWT authentication endpoint
- [x] BE-002: Implement user registration
- [x] BE-005: Implement RBAC middleware
- [x] BE-010: CRUD endpoints for Organizations
- [x] BE-011: CRUD endpoints for Factories
- [x] BE-012: CRUD endpoints for Production Lines
- [x] BE-020: CRUD endpoints for Styles
- [x] BE-021: CRUD endpoints for Orders
- [x] BE-022: CRUD endpoints for Production Runs
- [x] BE-070: Excel upload endpoint
- [x] BE-075: File Preview API endpoint
- [x] BE-080 to BE-086 (AI Decision Logging)
- [x] FE-034: Production vs Target chart
- [x] FE-037: Drag & drop Excel upload widget
- [x] FE-039: Implement Widget Error Boundaries
- [x] FE-040: Implement Dynamic Dashboard (RGL)
- [x] FE-045: Add lazy loading to widget registry
- [x] SV-001 to SV-004 (Excel Parser)
- [x] SV-010 to SV-013 (LLM Agent)
- [x] IN-001 to IN-005, IN-007 (Docker/Infra)
- [x] IN-010 to IN-012 (DB Setup)
- [x] IN-030 (Logging)
- [x] TS-001, TS-004, TS-007 (Backend Tests)
- [x] TS-010, TS-010a/b, TS-020 (Frontend Tests)
- [x] DC-001, DC-002 (Docs)
- [x] SC-001 to SC-003 (Security)
- [x] DARK-001, DARK-002, DARK-010 to DARK-013 (Dark Mode)
