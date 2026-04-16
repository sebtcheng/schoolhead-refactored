# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full dev (frontend + backend concurrently)
npm run dev:full

# Frontend only (Vite dev server, proxies /api to localhost:3000)
npm run dev

# Backend only (Express API server with watch mode)
npm run server

# Alternative full dev (turbo mode)
npm run dev:turbo

# Production build
npm run build

# Lint
npm run lint

# Preview production build
npm run preview

# Deploy to staging / heal staging / heal production
npm run deploy:staging
npm run heal:staging
npm run heal:production

# Run one-off diagnostic/migration scripts individually (not via npm)
node api/<script>.js
```

There is no test runner configured — the `tests/` directory exists but has no test framework set up.

## Architecture

InsightEd is a **school infrastructure data collection and monitoring PWA** for the Philippine DepEd (Department of Education). It supports multiple user roles collecting and reviewing school/project data, with offline-first capabilities.

### Frontend (`src/`)

- **Entry:** `src/main.jsx` → wraps with `AuthProvider`, `ThemeProvider`, `ServiceWorkerProvider`
- **Routing:** `src/App.jsx` — React Router v7 **HashRouter** (important for static hosting) with 40+ routes, role-based access control, animated transitions via Framer Motion. Maintenance mode check polls `/api/settings/maintenance_mode` every 5 minutes.
- **Modules:** `src/modules/` — large role-specific dashboard pages (SchoolHead, Engineer, EFD, LGU, BEFF, Finance, HR, Agency, etc.)
- **Forms:** `src/forms/` — wizard-style data entry forms for both School Head units and Engineer forms
- **Modular units:** `src/components/modular/` — School Head data collection split into Unit1–Unit10 components
- **Offline:** `src/sw.js` (Workbox `injectManifest` service worker) + `src/db.js` (IndexedDB via `idb`, version 13)
- **Locations data:** `src/locations.json` (~745 KB) — Philippine barangay/municipality/province data
- **Contexts:** `src/context/` — `AuthContext` (auth state + logout passcode), `EFDFilterContext` (filter state for EFD views), `ThemeContext`, `ServiceWorkerContext`
- **Utils:** `src/utils/` — `ReportGenerator.js` (PDF export via jsPDF), `chunkedUploader.js` (large file upload), `imageCompression.js`, `submissionHelper.js`, `dataNormalization.js` (front-end normalization like `normalizeOffering`), `assetHelper.js`

### Backend (`api/`)

- **Entry:** `api/index.js` — Express 5.2 server. All route handlers, Zod validation schemas, and utility functions (normalizers, duplicate shield) live in this single large file (~21 000 lines, 316+ routes).
- **DB init:** `api/db_init.js` — runs schema migrations and table creation on server startup (`initOtpTable`, `runMigrations`). All schema changes are additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations, not a Knex migration file.
- **AI chatbot:** `api/chatbot.js` — exports `teachChatbot`, `chatWithKnowledge`, `setPool`, `updateKnowledgeEntry`, `deleteKnowledgeEntry` (Google Gemini + LangChain).
- **Auth:** `api/middleware/authMiddleware.js` — JWT verification, attaches decoded payload to `req.user`.
- **Utilities:** `api/utils/safetyScore.js` (risk index calculation), `api/utils/binaryPipeline.js` (binary/file upsert helper).
- **One-off scripts:** The `api/` root contains many loose diagnostic/migration scripts (`check_*.js`, `fix_*.js`, `migrate_*.js`, `seed_*.js`, etc.) and the `api/db/` and `api/scripts/` folders contain `.cjs` schema-change scripts. These are NOT part of the Express server; run them individually with `node api/<script>.js` when needed.
- **PM2 config:** `ecosystem.config.cjs` at the repo root — used for production process management.
- **File storage:** Azure Blob Storage (migrated from Firebase Storage).
- **Auth middleware:** JWT-based. Firebase Admin SDK is stubbed out / legacy.

#### Core DB tables (created/migrated by `api/db_init.js`)

| Table | Purpose |
|-------|---------|
| `users` | All user accounts |
| `school_profiles` | School Head survey data (Units 1–10 columns) |
| `ph_schools` | School registry (IERN-keyed) |
| `ph_school_completion` | Per-school unit completion flags |
| `engineer_form` | Engineer/Architect project records |
| `engineer_image` / `engineer_documents` | Files linked to engineer projects |
| `lgu_projects` | LGU project records |
| `finance_projects` | Finance project records |
| `facility_inventory` / `facility_rooms` | Physical facility data |
| `ph_buildings_repairs` / `ph_buildings_demolition` / `ph_buildings_inventory` | Unit 7 building condition data |
| `school_location_profiles` | Unit 8 location data (JSONB columns) |
| `pending_schools` / `school_documents` / `school_ownership_docs` | Document pipeline |
| `unified_binaries` | Blob metadata store for all uploaded files |
| `activity_logs` | Audit trail |
| `notifications` | In-app notifications |
| `system_settings` | Key/value app config (e.g. `maintenance_mode`) |
| `chatbot_knowledge` | RAG knowledge base for AI chatbot |
| `verification_codes` | OTP codes for email verification |

### Key Patterns

#### Role-based access
User roles drive which dashboard loads. Role groups are defined in `src/config/roleGroups.js`:
- `EDUCATIONAL_ADMIN` — Super User / Super Admin (National HROD Portal)
- `TECHNICAL_FINANCE` — National Project Summary
- `MANAGEMENT` — Regional Office, SDO, Central Office, Admin, HR, Regional Engineer
- `INFRA_OPERATIONAL` — Engineer, DepEd Engineer, Division Engineer, EFD Engineer, Non-DepEd Engineer, Architect, Implementing Agency, LGU, Finance, PGO, CGO, MGO, DPWH, CSO
- `SCHOOL` — School Head

`ProtectedRoute` accepts either `allowedRoles` (array of role strings) or `allowedGroups` (using `ROLE_GROUPS` constants). After logout, `lastRole` is saved to localStorage to redirect back to the correct portal login path.

#### Super User impersonation / audit mode
Super Users can impersonate other roles to audit school data. Key sessionStorage keys used:
- `isViewingAsSuperUser` — set to `'true'` when entering audit mode (makes `useReadOnly` return `isReadOnly: true`, blocking saves)
- `impersonatedRole` — e.g. `'Central Office'` or `'EFD Engineer'`
- `impersonatedRegion` / `impersonatedDivision` — filter scope for the impersonated view

`SuperUserFloatingSwitch` (fixed bottom-right) lets Super Users toggle between HROD (`/educational-dashboard`) and Infrastructure (`/project-summary-dashboard`) portals, and export PDF reports. Use the `useReadOnly()` hook in any component that should block writes during audit mode.

#### Auth flow
- JWT stored in `localStorage.token`. Validated on mount via `GET /api/auth/me` (7 s timeout).
- Logout requires a **6-digit passcode** (`confirmLogout()` in `AuthContext`) — calls `POST /api/auth/verify-passcode` before clearing session.
- `AuthContext` syncs user fields into many localStorage keys: `userId`, `userRole`, `schoolId`, `userEmail`, `accountCategory`, `userProvince`, `userCity`, `uid`, `remembered_user`.
- On School Head login, `seedUnit1FromMaster()` runs as a background task to pre-populate Unit 1 drafts from the school registry.

#### Offline sync
IndexedDB (`InsightEd_Outbox`, v13) is the write-first store with 9 object stores:
- `pending_requests` — School Head outbox
- `engineer_pending` — Engineer outbox
- `projects_cache`, `gallery_cache`, `schools_cache` — read caches
- `unit_drafts`, `unit_1_draft_store` — School Head draft progress
- `modular_outbox` — completed modular units awaiting sync
- `facility_repairs` — offline repair queue

Service worker background sync tags: `sync-surveys`, `sync-facility-repairs`, `sync-modular-outbox`.

#### Data integrity helpers (in `api/index.js`)
- **`normalizeProjectCategory(raw)`** — maps raw category strings (e.g. `"REPAIR AND REHAB"`) to canonical values via `CATEGORY_ALIASES`. Always run on save and import.
- **`normalizeLocationField(val)`** / **`normalizeLocationOutput(val)`** — fixes Ñ encoding artifacts (`?`, `??`, `\uFFFD`) and uppercases location strings for DB consistency.
- **`isDuplicateSnapshot(newData, oldData)`** — "Digital Clone" check: compares project data objects ignoring IDs/timestamps to prevent duplicate saves.
- **`safeNumeric`** / **`safeBoolean`** — Zod preprocessors that coerce empty strings, `NaN`, and string booleans. Use these on all numeric/boolean form fields to prevent Postgres `22P02` errors.

#### Dev proxy
Vite proxies `/api/*` and `/uploads/*` → `http://127.0.0.1:3000`. App version is read from `package.json` and exposed as `import.meta.env.VITE_APP_VERSION`.

### Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 19, Tailwind CSS 3.4, Framer Motion |
| Routing | React Router v7 (HashRouter) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Maps | Leaflet + React Leaflet |
| API | Express 5.2, Zod validation |
| Database | PostgreSQL + Knex |
| Offline | Workbox (injectManifest) + IndexedDB (idb) |
| AI | Google Gemini + LangChain |
| Storage | Azure Blob Storage |
| Auth | JWT (Firebase Auth is legacy/stubbed) |
| Build | Vite 7.2 + Vite PWA plugin |

### Environment

The app requires a `.env` file with credentials for PostgreSQL, Azure Blob, Google Gemini API, JWT secret, Firebase Admin, and email (Nodemailer). See the existing `.env` for required keys — never commit it.
