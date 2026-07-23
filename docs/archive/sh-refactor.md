<aside>
⚡

**Execute-verbatim implementation prompt.** Paste this whole document to the coding agent that will restructure `clea241/InsightEd-SchoolHead-Official-2.0`. It converts the current single-package monorepo into a **feature-first workspace** (`apps/*` + `packages/*`). Every task is grounded in real files from the codebase synthesis. Do not skip phases; each phase has an exit gate, and the final phase verifies the whole system still works.

</aside>

## 0. OBJECTIVE & NON-NEGOTIABLES

**Scope (one line):** Reorganize the repo from layer-first (`src/` + `server/`) into a feature-first pnpm workspace where each project (`school-head`, `siif`, future `esf7`) owns its own `web/` + `api/` under `apps/`, and all cross-project code lives in `packages/shared-*` — **a pure code-organization move with zero runtime behavior change**.

**Preserve-list (must NOT change behavior or contracts):**

- All HTTP endpoints and their resolved paths, request/response JSON keys (e.g. `POST /api/siif/submit`, `PUT /api/ph_schools/unit2/:id`, `POST /api/register-beta`, `GET /api/asset/:id`).
- All DB table/column names and the **single shared PostgreSQL database** — `siif`, `school-head`, and `esf7` all continue to point at the **same** `DATABASE_URL`. This is a code split, NOT a database split.
- `server/db_init.js` migrations + the "Nuclear Lock" (`fn_prevent_truncate`, `fn_prevent_deletion`, RLS) — these span the whole DB and must still run exactly once on the primary worker.
- Auth contract: JWT via `authMiddleware.js`, 30-day tokens, role strings verbatim (`'School Head'`, etc.).
- Offline/PWA flow: `src/db.js` (IndexedDB stores), `src/sw.js` (Workbox), HashRouter behavior.
- The Vercel serverless-function count discipline (the `api/ → server/` move already exists to stay under the Hobby 12-function limit — do not reintroduce >12 functions per deploy).

**Single allowed exception:** Import paths and file locations may change (that is the entire point of this task). Every moved symbol must keep its exact export name; only its path changes, resolved via workspace aliases.

**Hard rules (obey):** (1) Never guess/invent — if a required value is missing, insert a bold `STOP AND ASK:` note inline and continue. (2) Ground every instruction in real files/tables/endpoints from §1. (3) Quote reference values verbatim. (4) Preserve logic/contracts per the list above. (5) Single source of truth — one `db.js`, one `authMiddleware`, one migration runner shared by all apps. (6) Conflict precedence: preserve logic → base config → per-app override. (7) Full coverage: every revision maps to exactly one task Rn. (8) Deterministic, imperative instructions only.

---

## 1. TARGET CODEBASE MAP

**Stack (verbatim from synthesis):** Single-package monorepo, `package.json` `"name": "insighted"` v1.0.26, ESM (`"type": "module"`). Frontend: React 19 + react-router-dom 7 (HashRouter) + Vite 7 + Tailwind 3 + vite-plugin-pwa. Backend: Node (ESM) + Express 5 + `pg` + knex + node-cron. Deploy: Vercel (`vercel.json`) + PM2 (`ecosystem.schoolhead-staging.config.cjs`) + nginx (`stride.conf`).

**Current entry points:** Frontend `index.html` → `src/main.jsx` → `src/App.jsx`. Backend `api/index.js` (`startServer()`, `export default app`). Service worker `src/sw.js`.

**Files/dirs in scope to MOVE (grouped by destination):**

| Current path | New path | Owner |
| --- | --- | --- |
| `server/utils/db.js` (pool, safeQuery, cachedQuery, updateSchoolTotalCompletion) | `packages/shared-db/src/db.js` | shared |
| `server/db_init.js` (migrations, triggers, Nuclear Lock) | `packages/shared-db/src/db_init.js` | shared |
| `server/utils/helpers.js` (uploads, email, Azure, PDF/Hydra, multer) | `packages/shared-io/src/helpers.js` | shared |
| `server/middleware/authMiddleware.js` | `packages/shared-auth/src/authMiddleware.js` | shared |
| `server/units/unit1…unit9/index.js` | `apps/school-head/api/units/unit1…unit9/index.js` | school-head |
| `server/units/auth/*` (login.js, registration.js, index.js) | `apps/school-head/api/units/auth/*` | school-head |
| `server/units/{docs,dashboard,settings,push,chat,location}/index.js` | `apps/school-head/api/units/*` | school-head |
| `api/index.js` (composition, CORS, load-shedding, mounts) | `apps/school-head/api/index.js` | school-head |
| `server/modules/siif/index.js`  • `routes/{allocation,feedback,health,monitoring,profile,settings,submission,system,utilization}.js`  • `middleware/authenticate.js`  • `helpers/resolveSchoolId.js` | `apps/siif/api/*` | siif |
| `src/` School Head UI (App.jsx, main.jsx, firebase.js, db.js, sw.js, lib/api.js, all non-SIIF pages/components) | `apps/school-head/web/src/*` | school-head |
| SIIF frontend: `SIIFModule`  • SIIF pages/cards/hooks (e.g. `BeneficiariesCard.jsx`, `useSIIFDeadline.js`) currently under `src/modules/siif/**` | `apps/siif/web/src/*` | siif |
| Shared UI atoms: `LoadingScreen`, `ModernDatePicker`, `PageTransition`, `YearInput` | `packages/shared-ui/src/*` | shared |

**Must NOT be moved or split:** the physical database; `server/db_init.js` logic (only its location moves — it still runs once); the Nuclear Lock; env var *names*. `STOP AND ASK:` confirm the exact current directory of SIIF frontend files if they are not under `src/modules/siif/**` (synthesis lists SIIF UI as scattered in shared `src/` — the agent must grep for `SIIFModule`, `siif`, and route `/siif/*` in `src/App.jsx` to enumerate them before moving).

**SIIF backend endpoints (mounted at `/api/siif`, preserve verbatim):** `GET /submission/:schoolId`, `POST /submit`, `POST /utilization`, `/allocation/:schoolId`, `/feedback`, `/metrics`, `/ro-monitoring`, `/sdo-monitoring`, `/users/update`, `/auth/change-password`, `/auth/setup-passcode`, `/settings/deadline`, plus `health`, `system`.

**SIIF-owned DB tables:** `siif_submissions`, `siif_interventions`, `siif_beneficiaries`, `siif_activities`, `siif_utilization`, `siif_allocations`. **Shared tables SIIF reads (do not duplicate):** `users`, `settings` (keys `siif_form_start`, `siif_form_end`, `siif_deadline`), `schools_IERN`.

---

## 2. VERBATIM REFERENCE MATERIAL

**Target root layout (create exactly this):**

```
repo/
├── apps/
│   ├── school-head/
│   │   ├── web/     # React/Vite PWA (was src/)
│   │   └── api/     # Express (was api/index.js + server/units/*)
│   ├── siif/
│   │   ├── web/     # SIIF UI (was src/modules/siif/**)
│   │   └── api/     # was server/modules/siif/**
│   └── esf7/        # deferred — stub only (see R14)
├── packages/
│   ├── shared-db/   # db.js, db_init.js, migrations, Nuclear Lock
│   ├── shared-auth/ # authMiddleware.js, JWT/bcrypt helpers
│   ├── shared-io/   # helpers.js: uploads, email, Azure, PDF pipeline
│   ├── shared-ui/   # LoadingScreen, ModernDatePicker, PageTransition, YearInput
│   └── shared-types/# cross-app contracts
├── package.json     # workspace root (private)
├── pnpm-workspace.yaml
└── turbo.json
```

**Root `pnpm-workspace.yaml` (verbatim):**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Root `package.json` keys to set (verbatim):** `"private": true`, `"packageManager": "pnpm@9"`, `"type": "module"`, `"workspaces": ["apps/*", "packages/*"]`, and scripts `"dev": "turbo run dev"`, `"build": "turbo run build"`, `"lint": "turbo run lint"`. `STOP AND ASK:` confirm the desired pinned Node version if it must differ from the current runtime.

**Workspace path aliases (add to each app's `vite.config.js` / `tsconfig` and to `package.json` deps as `workspace:*`):** `@shared/db`, `@shared/auth`, `@shared/io`, `@shared/ui`, `@shared/types`.

**`turbo.json` pipeline (verbatim):**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".vercel/**"] },
    "lint": {}
  }
}
```

**Filtered commands (use these to scope work to one project):** `pnpm --filter siif dev`, `pnpm --filter school-head build`, `turbo run dev --filter=siif`.

**Preserve verbatim (do not alter these literals during moves):** JWT fallback appears as `process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD'` in the moved auth files — keep the code identical (its remediation is a separate task, out of scope here). SIIF deadline lock reads settings keys `'siif_form_start'`, `'siif_form_end'`, `'siif_deadline'` — keep exact strings. Default school year literal `'SY 26-27'` — keep exact.

---

## 3. LAYOUT / INTERACTION CONTRACT

N/A — this is a structural/build reorganization, no UI template applies. All rendered output, routes (`/siif/*`, `/modular/unit-1…unit-9`, `/nodes-dashboard`, etc.), and component trees must render **identically** before and after. The only permitted change is the physical file path an import resolves to.

---

## 4. NUMBERED REVISIONS (PHASED)

Execute phases in order. Do not start a phase until the previous phase's **Exit gate** passes.

### Phase 0 — Safety Net & Baseline

**R1 — Create a working branch and capture baseline.**

- Where: repo root.
- Do: create branch `refactor/feature-first-monorepo`. Record a baseline by running the existing dev/build once and saving the current route list, the `api/index.js` router-mount order, and `git ls-files` output to `RESTRUCTURE_BASELINE.md`.
- Data bindings: none.
- Preserve: `main`/production branch untouched; no force-push.

**Exit gate:** branch created; baseline file committed; current build succeeds unchanged.

### Phase 1 — Workspace Scaffolding

**R2 — Initialize pnpm workspaces.** Where: root. Do: add `pnpm-workspace.yaml` and root `package.json` from §2; create empty `apps/` and `packages/` dirs. Preserve: existing `package.json` deps list (they will be split later, not deleted yet).

**R3 — Add Turborepo.** Where: root. Do: add `turbo.json` from §2; add `turbo` as a root dev dependency. Preserve: existing npm scripts as `:legacy` copies until Phase 7 confirms parity.

**R4 — Establish path-alias convention.** Where: root `tsconfig.base.json` (create). Do: declare aliases `@shared/db`, `@shared/auth`, `@shared/io`, `@shared/ui`, `@shared/types`. Preserve: no source moved yet.

**Exit gate:** `pnpm install` resolves the empty workspace with no errors.

### Phase 2 — Extract Shared Packages (move shared code FIRST)

**R5 — Create `packages/shared-db`.** Where: move `server/utils/db.js` → `packages/shared-db/src/db.js` and `server/db_init.js` → `packages/shared-db/src/db_init.js`. Do: add package `package.json` (`"name": "@shared/db"`), export `pool`, `safeQuery`, `cachedQuery`, `updateSchoolTotalCompletion`, `runMigrations`, `initOtpTable`. Data bindings: preserve advisory locks `7777777` / `8888` and the single `DATABASE_URL`/`NEW_DATABASE_URL` resolution. Preserve: Nuclear Lock, `safeQuery` retry, `cachedQuery` 90s TTL — byte-for-byte.

**R6 — Create `packages/shared-auth`.** Where: move `server/middleware/authMiddleware.js` → `packages/shared-auth/src/authMiddleware.js`. Do: export default middleware + any JWT/bcrypt helpers. Data bindings: keep `process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD'` verbatim. Preserve: `req.user` shape.

**R7 — Create `packages/shared-io`.** Where: move `server/utils/helpers.js` → `packages/shared-io/src/helpers.js`. Do: export `UPLOAD_BASE_PATH`, `getUploadPath`, `transporter`, `blobServiceClient`, `compressBufferTo90Dpi`, multer configs (`schoolDocsUpload`, `projectPhotosUpload`, `memoryUpload`), role/location normalizers. Preserve: Hydra >25MB shard logic, `compress_pdf.py` shell-out.

**R8 — Create `packages/shared-ui`.** Where: move shared atoms `LoadingScreen`, `ModernDatePicker`, `PageTransition`, `YearInput` from `src/components/` → `packages/shared-ui/src/`. Do: export each with unchanged name. Preserve: props/styling. `STOP AND ASK:` if any of these atoms import app-specific context, list them rather than moving.

**R9 — Create `packages/shared-types`.** Where: new. Do: house cross-app contract types (submission/allocation shapes consumed by both SIIF api and web). Preserve: field names verbatim.

**Exit gate:** all four `packages/*` build in isolation; no remaining imports point at `server/utils/db.js`, `server/db_init.js`, `server/utils/helpers.js`, or `server/middleware/authMiddleware.js` (grep returns zero old paths).

### Phase 3 — Establish `apps/school-head` (the core app)

**R10 — Move School Head backend.** Where: move `api/index.js` → `apps/school-head/api/index.js`; move `server/units/{unit1..unit9,auth,docs,dashboard,settings,push,chat,location}` → `apps/school-head/api/units/*`. Do: rewrite imports to `@shared/db`, `@shared/auth`, `@shared/io`. Keep the exact router-mount order and all resolved paths (`/api/ph_schools/*`, `/api/auth/*`, `/api/asset/:id`, etc.). Data bindings: unchanged tables. Preserve: CORS allowlist, 500mb body limit, School-Year Lock guard, admission-control load shedding, `autoCleanOldChats` cron, `initOtpTable()` + `runMigrations()` on primary worker only.

**R11 — Move School Head frontend.** Where: move `src/` (minus SIIF files) → `apps/school-head/web/src/`; move `index.html`, `vite.config.js` (School Head), Tailwind/PostCSS configs into `apps/school-head/web/`. Do: rewire shared-atom imports to `@shared/ui`. Preserve: `src/main.jsx` → `App.jsx` bootstrap, HashRouter, `src/db.js` IndexedDB stores, `src/sw.js` Workbox queues, `src/firebase.js`, `src/lib/api.js` base-URL resolution.

**Exit gate:** `pnpm --filter school-head dev` boots the API and serves the UI; all non-SIIF routes render; migrations still run once.

### Phase 4 — Carve Out `apps/siif`

**R12 — Move SIIF backend.** Where: move `server/modules/siif/index.js` + `routes/*.js` + `middleware/authenticate.js` + `helpers/resolveSchoolId.js` → `apps/siif/api/`. Do: rewrite imports to `@shared/db`, `@shared/auth`. Keep `siifRouter` composition (`allocation, feedback, health, monitoring, profile, settings, submission, system, utilization`) and mount prefix `/api/siif`. Data bindings: `siif_submissions`, `siif_interventions`, `siif_beneficiaries`, `siif_activities`, `siif_utilization`, `siif_allocations` (writes) + `users`, `settings`, `schools_IERN` (reads via `@shared/db`). Preserve: the deadline-lock reading `siif_form_start`/`siif_form_end`, the `SET LOCAL internal.authorized_app_deletion = 'true'` re-submission bypass, the `spent_amount` sync in `utilization.js`. **Remove** the hard-coded absolute path `C:/Users/KleinZebastianCatapa/.../submit-error.log` write in `submission.js` — replace with a relative log or logger call. (This is the ONE incidental fix explicitly authorized because the literal path breaks on any other machine.)

**R13 — Move SIIF frontend.** Where: move enumerated SIIF UI (`SIIFModule`, SIIF pages/cards/hooks e.g. `BeneficiariesCard.jsx`, `useSIIFDeadline.js`) → `apps/siif/web/src/`. Do: rewire `@shared/ui`, `@shared/types`. Preserve: `/siif/*` routing behavior and every SIIF payload key (`interventions`, `interventionData`, `budgetEstimates`, `aral`, `priorityAreas`, `utilizationData`). `STOP AND ASK:` output the exact file list discovered by the §1 grep before moving, and confirm whether SIIF should mount as its own Vite app or remain a lazy-loaded route inside School Head's web app (both are viable; this changes deploy topology).

**Exit gate:** `pnpm --filter siif dev` (or the confirmed mount mode) serves the SIIF module; `POST /api/siif/submit`, `POST /api/siif/utilization`, and `GET /api/siif/submission/:schoolId` return identical shapes to baseline.

### Phase 5 — Defer ESF7

**R14 — Stub `apps/esf7` without inventing functionality.** Where: create `apps/esf7/README.md` only. Do: document that ESF7 currently exists solely as the `esf7_link` table (status values SUBMITTED/PROCESSING/QUEUE/VERIFIED) with no dedicated FE/BE, and list the extraction criteria for when it becomes a real app. Preserve: do NOT create endpoints, components, or tables. `STOP AND ASK:` if ESF7 is expected to be a full app now, request its route list and screens.

**Exit gate:** `apps/esf7` contains documentation only; no code, no new DB objects.

### Phase 6 — Deploy & Boundary Wiring

**R15 — Per-app deploy config.** Where: add `apps/school-head/vercel.json` and `apps/siif/vercel.json` (if SIIF deploys standalone); update PM2 `ecosystem.schoolhead-staging.config.cjs` to point at `apps/school-head/api/index.js`. Do: ensure each Vercel project stays under the 12 serverless-function limit (the reason the original `api/ → server/` consolidation exists). Preserve: existing rewrite rules and the `/insighted-schoolhead` subpath normalization in `api/index.js`. `STOP AND ASK:` provide the Vercel project name(s)/root-directory setting per app.

**R16 — Enforce module boundaries.** Where: root ESLint config. Do: add an import-boundary rule so `apps/school-head` cannot import from `apps/siif` and vice-versa (cross-app code must go through `packages/*`). Preserve: allow both apps to import `@shared/*`.

**Exit gate:** each app builds independently via `turbo run build --filter=<app>`; boundary lint passes.

### Phase 7 — Full Verification ("ensure everything is working properly")

**R17 — Static/build parity.** Do: `pnpm install` clean; `turbo run build` builds all apps+packages; grep confirms zero imports referencing old `src/`, `server/`, or `api/index.js` paths; `git ls-files` diff shows only moves (no unexpected deletions vs `RESTRUCTURE_BASELINE.md`).

**R18 — Backend runtime smoke test.** Do: boot `apps/school-head/api`; verify on the primary worker: `runMigrations()` runs exactly once (advisory lock `7777777`), Nuclear Lock present, crons scheduled. Hit `GET /api/ping` (expect version `v1.2.5-STAGING-OMEGA-TOP`), `GET /api/health`, `GET /api/pool-status`.

**R19 — Endpoint contract regression.** Do: exercise one endpoint per moved router against baseline shapes: `POST /api/auth/migrate-login`, `POST /api/register-beta` (writes `users`+`ph_schools`+`unit1_school_identity`), `PUT /api/ph_schools/unit2/:id`, `POST /api/save-physical-facilities` (unit7), `PUT /api/ph_schools/unit9/:id`, `GET /api/asset/:id`, and all three SIIF endpoints in R12. Every response JSON key must match baseline.

**R20 — Frontend + SIIF integration test.** Do: load School Head UI, confirm routes `/nodes-dashboard`, `/modular/unit-1…unit-9`, `/siif/*` render; submit a SIIF plan end-to-end and confirm `siif_submissions`/`siif_interventions`/`siif_beneficiaries`/`siif_activities` rows write and `spent_amount` syncs; confirm offline queue (`src/db.js`/`sw.js`) still registers.

**R21 — Scoped-workflow acceptance.** Do: prove the original goal — run `pnpm --filter siif dev` and confirm it starts SIIF **alone** with no School Head code in the build graph; confirm opening only `apps/siif/` exposes 100% of SIIF's FE+BE files.

**Exit gate:** all of R17–R21 pass; behavior identical to baseline; each project is independently runnable and self-contained.

---

## 5. CONFLICT-PREVENTION CHECKLIST

- [ ]  Every revision R1–R21 executed and traceable; none merged, dropped, or invented.
- [ ]  Exactly one `packages/shared-db/src/db.js`, one `db_init.js`, one `authMiddleware.js` — no duplicates across apps.
- [ ]  All apps use the SAME `DATABASE_URL` (no database was split).
- [ ]  `runMigrations()` still executes once on the primary worker; Nuclear Lock intact.
- [ ]  All resolved endpoint paths unchanged (grep old vs new route strings — identical set).
- [ ]  All response JSON keys unchanged vs `RESTRUCTURE_BASELINE.md`.
- [ ]  SIIF settings keys `siif_form_start`/`siif_form_end`/`siif_deadline` and `'SY 26-27'` preserved verbatim.
- [ ]  Hard-coded Windows log path removed from SIIF `submission.js` (only authorized incidental fix).
- [ ]  No `apps/school-head` ↔ `apps/siif` cross-imports; shared code only via `packages/*`.
- [ ]  Each Vercel deploy stays under 12 serverless functions.
- [ ]  `apps/esf7` is documentation-only; no fabricated endpoints/tables/components.
- [ ]  Every `STOP AND ASK` was answered before merge.

## 6. ACCEPTANCE CRITERIA

1. `pnpm install` + `turbo run build` succeed for all apps and packages from a clean checkout.
2. `pnpm --filter <app> dev` boots each project **independently**, and each `apps/<project>/` folder contains 100% of that project's frontend + backend — satisfying the "scope into one project" goal.
3. Runtime behavior is **byte-for-byte equivalent** to baseline: identical routes, identical response JSON keys, identical DB writes, migrations run once, crons/offline/PWA intact.
4. Every figure that must reconcile still reconciles from a single source: SIIF `spent_amount` (synced in `utilization.js`) equals the sum of `siif_utilization.utilized_amount` across the submission, and school completion via `updateSchoolTotalCompletion()` matches across `ph_school_completion` and `ph_schools`.
5. No hard-coded absolute filesystem paths remain in moved code.
6. Boundary lint proves apps cannot import each other's internals.
7. All Phase 7 (R17–R21) checks pass and are recorded against `RESTRUCTURE_BASELINE.md`.