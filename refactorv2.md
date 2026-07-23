# School Head (Refactored) — Implementation Prompt

<aside>
⚙️

Execute-verbatim implementation prompt for a coding agent. Repo `clea241/InsightEd-SchoolHead-Official-2.0` · branch `schoolhead-refactored` · commit `e43475931cf3ff16606e09783a721f797a4a6dde` (head reconfirmed, no drift). The code at that commit is the source of truth — not this document's prose.

</aside>

## 0. OBJECTIVE & NON-NEGOTIABLES

**Scope (one line):** In `apps/school-head` (+ `packages/shared-io`), fix the four defects — **R1** unresolved `utils/`/`middleware/` imports (compounded by a broken `@shared/io`), **R2** Unit 6 generic route + mislabeled payload, **R3** verify Unit 3/4/5/7 endpoints, **R4** dead `autoCleanOldChats()` scheduler — and change nothing else.

**Preserve-list (do NOT modify):**

- DB schema in `packages/shared-db/src/db_init.js`: all tables, columns, conflict keys, `update_unit_timestamp()` trigger, RLS / Nuclear-Lock policies.
- Join convention: Units 1–5 join on `iern`, Units 6–9 on `school_id`, always filtered by `school_yr`.
- Middleware order in `api/index.js`: `/api/ping` → subpath normalizer → CORS allowlist → `express.json` 500 mb → School-Year Lock → admission control → static `/uploads` → routers.
- School-Year Lock (`403 LOCKED_SCHOOL_YEAR` for `SY 25-26`; default active year `SY 26-27`).
- Every endpoint path, response shape, and `ON CONFLICT` key EXCEPT the Unit 6 path/payload changed in R2.
- Upload / Hydra pipeline, offline/PWA sync (`Outbox`/`SyncCenter`), JWT auth, boot-migration primary-worker guard.

**Single allowed exception:** R2 may rename the Unit 6 route path and its request-body keys. This is the ONLY sanctioned contract change; all other routes, tables, columns, and shapes remain byte-identical.

**Hard rules:**

1. Never guess, infer, invent, or substitute. If a required value is missing, insert a bold `STOP AND ASK:` note at that exact spot and continue with everything else.
2. Ground every instruction in exact files/routes/tables/columns/endpoints from §1–§2.
3. Quote reference values verbatim.
4. Preserve business logic, API contracts, data bindings, and offline/state flows unless a revision explicitly requires a change.
5. Single source of truth — the same identifier/value must reconcile everywhere.
6. Conflict precedence: (a) preserve logic → (b) base conventions → (c) explicit revision instruction overrides.
7. Full coverage: each revision maps to exactly one task Rn.
8. Deterministic, imperative output.

## 1. TARGET CODEBASE MAP

**Stack:** pnpm@9 + Turborepo monorepo · Express 5 (ESM) · React 19 + Vite 7 PWA · PostgreSQL (node-postgres) · Azure Blob + local disk · JWT.

**Files in scope:**

| File | Revision | Action |
| --- | --- | --- |
| `api/units/{unit1..unit9,auth,chat,dashboard,docs,location,push,settings}/index.js` | R1 | Migrate relative imports to `@shared/*` |
| `packages/shared-io/src/` (+ `helpers.js`) | R1 | Restore missing `binaryPipeline.js` / `upsertBinary` |
| `api/units/unit6/index.js`  • `web/src/components/modular/Unit6SchoolResources.jsx` | R2 | Rename route + payload keys |
| `api/units/{unit3,unit4,unit5,unit7}/index.js` | R3 | Verify endpoints (confirmed clean) |
| `api/index.js` | R4 | Remove or implement `autoCleanOldChats()` |

**Confirmed endpoints (verbatim):**

| Unit | Method + Path | Table(s) | Conflict key |
| --- | --- | --- | --- |
| 1 | `POST /api/ph_schools/unit1` | `unit1_school_identity` (+ `school_ownership_records`) | `(iern, school_yr)` |
| 2 | `PUT /api/ph_schools/unit2/:id` | `unit2_school_learners` | `(iern, school_yr)` |
| 3 | `PUT /api/ph_schools/unit3/:id` | `unit3_organized_classes` | `(iern, school_yr)` |
| 4 | `PUT /api/ph_schools/unit4/:id` | `unit4_learner_profile` | `(iern, school_yr)` |
| 5 | `PUT /api/ph_schools/unit5/:id` | `unit5_shifting_modality` | `(iern, school_yr)` |
| 6 | `PUT /api/ph_schools/:id` ⚠️ generic — R2 target | `unit6_school_resources` (+ `unit6_furniture_grades`, `unit6_ecart_batches`) | `(school_id, school_yr)` |
| 7 | multi-route master (see §2.6) | `unit7_*` tables | `(iern, school_yr)` / `(iern, space_name, school_yr)` |
| 8 | `GET`/`POST /api/school-location[/:id]` | `unit8_location` | `(school_id, school_yr)` |
| 9 | `GET`/`PUT /api/ph_schools/unit9/:id` | `unit9_safety` | `(school_id, school_yr)` |

**MUST NOT modify:** `db_init.js` schema and locks; the `api/index.js` middleware chain (except removing the R4 timer); all other routers' logic; existing `@shared/*` public exports beyond restoring `upsertBinary`.

## 2. VERBATIM REFERENCE MATERIAL

**2.1 Offending relative imports** (resolving to the absent `apps/school-head/api/utils/` and `apps/school-head/api/middleware/`):

```
../../utils/db.js
../../utils/helpers.js
../../utils/binaryPipeline.js
../../utils/updateSchoolTotalCompletion
../../middleware/authMiddleware.js
```

**2.2 Confirmed import → `@shared/*` mapping** (verified against each `package.json` `exports` + `src/`):

| Current relative import | Bindings used | Correct specifier |
| --- | --- | --- |
| `../../utils/db.js` | `pool`, `safeQuery`, `cachedQuery`, `poolNew` (named) | `@shared/db` (→ `src/db.js`) |
| `../../utils/updateSchoolTotalCompletion` | `updateSchoolTotalCompletion` (named) | `@shared/db` — same `db.js`, NOT a separate file |
| `../../utils/helpers.js` | `compressBufferTo90Dpi`, `getUploadPath`, `memoryUpload`, `schoolDocsUpload`, `projectPhotosUpload`, `normalizeRole`, `UPLOAD_BASE_PATH`, `transporter`, `blobServiceClient` (named) | `@shared/io` (→ `src/helpers.js`) |
| `../../middleware/authMiddleware.js` | `authMiddleware` (**DEFAULT** export) | `@shared/auth` (→ `src/authMiddleware.js`) |
| `../../utils/binaryPipeline.js` | `upsertBinary` (named) | ⚠️ no valid target yet — see §2.2a |

`@shared/db` also exposes subpath `@shared/db/db_init` (→ `src/db_init.js`). Package exports: db `{'.':'./src/db.js','./db_init':'./src/db_init.js'}`; auth `{'.':'./src/authMiddleware.js'}`; io `{'.':'./src/helpers.js'}`; all `type: module`. `authMiddleware` must stay a DEFAULT import after migration (confirmed in `units/chat/index.js`).

**2.2a ⚠️ `binaryPipeline.js` / `upsertBinary` is missing everywhere.** `packages/shared-io/src/` holds only `helpers.js` — there is no `binaryPipeline.js`, and `@shared/io` exports only `.` (→ `helpers.js`). Worse, `helpers.js` itself runs `import { upsertBinary } from './binaryPipeline.js'`, so `@shared/io` is itself unresolvable at this commit — independent of the missing app-level `utils/` folder. Restore `upsertBinary` (create `packages/shared-io/src/binaryPipeline.js` and re-export it, e.g. through `helpers.js`) so both `helpers.js` and the `docs` router resolve. **STOP AND ASK:** the canonical `upsertBinary` implementation/source (absent at this commit — cannot be recovered from the repo).

**2.3 Missing folders are uncommitted, NOT gitignored:** root `.gitignore` lists only `node_modules`, `dist`, `.env*`, `uploads/`, `scripts`, `*.sql`/`*.txt`/`*.log`, `data/`, etc. — it does NOT list `utils/`, `middleware/`, or `binaryPipeline`. The fix is genuine restoration, not un-ignoring.

**2.4 Unit 6 mislabeled request-body keys (current):** `unit7_furniture`, `unit7_ict`, `unit7_has_ecart`, `unit7_ecarts`, `unit7_wash`, `unit7_utilities` — written into `unit6_school_resources` on conflict `(school_id, school_yr)`. Frontend also sends dead flat `u7_*` fields (`u7_ict_smart_tv_cond`, `u7_confirm_no_grid`, …) the router never reads.

**2.5 Nuclear-Lock deletion bypass** (only if R4 implements deletion): `SET LOCAL internal.authorized_app_deletion = 'true'` inside the transaction.

**2.6 Unit 3/4/5/7 endpoints (R3 reference — verified correctly namespaced):**

- Unit 3/4/5: `PUT /api/ph_schools/unit{3,4,5}/:id`, each `ON CONFLICT (iern, school_yr)`.
- Unit 7 multi-route master: `GET /api/ph_schools/unit7/:id/master` · `GET /api/ph_schools/unit7/:id/facilities` · `GET /api/ph_schools/unit7/:id/spaces` · `POST /api/ph_schools/unit7/:id/spaces` (`ON CONFLICT (iern, space_name, school_yr)`) · `DELETE /api/ph_schools/unit7/spaces/:spaceId` · `GET /api/unit8/teachers/:id` (⚠️ mislabeled under `/api/unit8/`) · `POST /api/save-physical-facilities` (⚠️ non-namespaced; main save, writes `unit7_buildings_inventory`/`_repairs`/`_demolition`/`_school_buildable_spaces` + `unit7_facilities`).
- Dead import: `updateSchoolTotalCompletion` imported but never called in `unit5` and `unit7`.

*No design-system, CSS, token, or layout references apply — this is a backend-centric change set (R2 touches one frontend caller for path/key alignment only).*

## 3. LAYOUT / INTERACTION CONTRACT

N/A — no UI template or layout revision is in scope. R2 touches a frontend API caller only to align the fetch path and payload key names, not layout or interaction.

## 4. NUMBERED REVISIONS R1..R4

### R1 — Resolve missing `utils/`/`middleware/` imports + repair `@shared/io`

- **Where:** every router under `api/units/{unit1..unit9,auth,chat,dashboard,docs,location,push,settings}/index.js`; plus `packages/shared-io/src/`.
- **Do:** replace each relative import per the §2.2 mapping — `../../utils/db.js` → `@shared/db`; `../../utils/updateSchoolTotalCompletion` → `@shared/db`; `../../utils/helpers.js` → `@shared/io`; `../../middleware/authMiddleware.js` → `@shared/auth` (keep the DEFAULT import form). Then repair `@shared/io` per §2.2a: create `packages/shared-io/src/binaryPipeline.js` exporting `upsertBinary`, ensure `helpers.js`'s `import { upsertBinary } from './binaryPipeline.js'` resolves, and route the `docs` router's `../../utils/binaryPipeline.js` to `@shared/io`. **STOP AND ASK:** the canonical `upsertBinary` source before writing its body — do not fabricate the PDF-sharding logic.
- **Optional cleanup:** remove the dead `updateSchoolTotalCompletion` import from `unit5` and `unit7` (imported, never called) — only if it does not alter behavior.
- **Data bindings:** imports only — no query/column changes.
- **Preserve:** every router's routes, handlers, behavior; all existing `@shared/*` named exports.

### R2 — Fix Unit 6 route + payload naming

- **Where:** backend `api/units/unit6/index.js`; frontend `web/src/components/modular/Unit6SchoolResources.jsx` (confirmed — the only caller of this route).
- **Do (backend):** rename `router.put('/api/ph_schools/:id', …)` → `router.put('/api/ph_schools/unit6/:id', …)`, and rename the destructured body keys `unit7_furniture` / `unit7_ict` / `unit7_has_ecart` / `unit7_ecarts` / `unit7_wash` / `unit7_utilities` → `unit6_*`.
- **Do (frontend — 3 URL sites + payload):** online submit `fetch(api('/api/ph_schools/<schoolId>'), { method: 'PUT' })` → path `/api/ph_schools/unit6/<schoolId>`; the two offline `addModularToOutbox({ url: api('/ph_schools/<schoolId>'), method: 'PUT' })` sites → `api('/ph_schools/unit6/<schoolId>')`. Rename the same `unit7_*` keys in the `payload`. Here `schoolId = localStorage.getItem('schoolId')`. NOTE: `api()` strips a leading `api/`, so both URL forms resolve to the same path before and after the rename.
- **Dead keys (optional):** the payload also sends flat `u7_*` fields the router never reads; leave or delete, but do not depend on them.
- **Data bindings:** keep upserting into `unit6_school_resources` (+ `unit6_furniture_grades`, `unit6_ecart_batches`) on conflict `(school_id, school_yr)`. The post-success secondary sync `POST /api/ph_schools/unit9/<schoolId>/ecarts` is a different route — do not rename it.
- **Preserve:** table targets, conflict key, upsert logic, offline/outbox flow; do not touch any other `/api/ph_schools/*` route.

### R3 — Verify Unit 3/4/5/7 endpoints

- **Where:** `api/units/{unit3,unit4,unit5,unit7}/index.js`.
- **Do:** VERIFICATION — already confirmed (see §2.6): Units 3/4/5 use namespaced `PUT /api/ph_schools/unit{3,4,5}/:id`; Unit 7 uses a namespaced multi-route master. **No route renames required** — Unit 6 (R2) is the only generic-path collision. Do not modify these routers' paths, tables, or conflict keys.
- **Optional (non-colliding, cosmetic — do only if explicitly approved):** rename Unit 7's `GET /api/unit8/teachers/:id` to a `/api/ph_schools/unit7/...` namespace, and/or namespace `POST /api/save-physical-facilities`. Both currently work; renaming requires matching frontend caller updates. **STOP AND ASK** before touching either, since they are outside the sanctioned R2 exception.
- **Preserve:** all Unit 3/4/5/7 upsert logic, paths, and `school_yr` default `SY 26-27`.

### R4 — Resolve `autoCleanOldChats()` stub

- **Where:** `api/index.js`.
- **Do:** choose exactly ONE: (a) remove the no-op function together with its 24 h `setInterval` and startup timer; or (b) implement it to delete `chat_messages` older than a retention window. **STOP AND ASK:** the exact retention window before implementing any deletion.
- **Data bindings:** if implementing deletion, target `chat_messages.created_at`; the `DELETE` MUST run inside a transaction with `SET LOCAL internal.authorized_app_deletion = 'true'` (Nuclear Lock, §2.5).
- **Preserve:** all other boot logic and the primary-worker-only migration guard.

## 5. CONFLICT-PREVENTION CHECKLIST

- [ ]  R1: import style reconciles across all 16 routers and matches `api/index.js` (`@shared/*`).
- [ ]  R1: no relative import to `utils/` or `middleware/` remains anywhere.
- [ ]  R1: `@shared/io` repaired — `packages/shared-io/src/binaryPipeline.js` exists and `upsertBinary` resolves for both `helpers.js` and the `docs` router.
- [ ]  R2: route path, request-body keys, and table target all use consistent `unit6_*` naming.
- [ ]  R2: all 3 frontend URL sites (1 online fetch + 2 outbox) and the `unit7_*` payload keys updated in lockstep with the backend route rename.
- [ ]  R2: no other `/api/ph_schools/*` route is regressed by the rename.
- [ ]  R3: Unit 3/4/5/7 paths confirmed unchanged; only Unit 6 was renamed.
- [ ]  R4: a single decision made (remove OR implement) — no partial stub left behind.
- [ ]  R4: any `chat_messages` deletion uses the authorized-deletion bypass inside a transaction.
- [ ]  DB schema, conflict keys, and middleware order are unchanged.
- [ ]  Every `STOP AND ASK` is answered before merge.

## 6. ACCEPTANCE CRITERIA

- All 16 routers resolve their imports AND `@shared/io` resolves (`upsertBinary` restored); the app boots with no unresolved-module errors.
- Unit 6 write flow works end-to-end via `PUT /api/ph_schools/unit6/:id` with `unit6_*` payload → `unit6_school_resources`, with no route collision.
- Units 3/4/5/7 endpoints confirmed collision-free and unchanged.
- `autoCleanOldChats()` is either fully removed or a working, Nuclear-Lock-compliant cleanup.
- No preserved contract, schema, trigger, or middleware behavior changed.
- **Reconciliation:** the `unit6` identifier is identical across route path, body keys, and table name; the alias set `@shared/db` / `@shared/auth` / `@shared/io` is identical across every router and `index.js`. Every identifier appearing in more than one place matches exactly.