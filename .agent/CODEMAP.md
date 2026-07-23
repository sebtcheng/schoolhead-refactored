## How to use this file (read first)

1. Find the request in **§3 Task → Files** and open ONLY the listed files.
2. Cross-check paths against **§2 Topology** if a path 404s.
3. Obey **§8 Golden rules** — never change endpoints, DB schema, or business logic unless the task explicitly says so.
4. If a file isn't listed here, grep the router/component name before reading anything else. Do **not** read `components/modular/Unit*.jsx` wholesale — they are 200 KB+ each.

> Stack: pnpm@9 + Turborepo · Express 5 (ESM) · React 19 + Vite 7 PWA · PostgreSQL (node-postgres) · Azure Blob + local disk · JWT auth. All backend imports use `@shared/*` aliases.
> 

---

## 1 · Read-order budget (cheapest path to context)

<aside>
⚡

Open files in this order and STOP once you have enough. Most edits need 1–3 files.

</aside>

1. This file (`.agent/CODEMAP.md`).
2. The single router or component named in §3.
3. `packages/shared-db/src/db_init.js` — ONLY if the change touches schema/columns.
4. `apps/school-head/api/index.js` — ONLY if the change touches middleware, mounting, CORS, or startup.

---

## 2 · Monorepo topology (authoritative paths)

```
insighted/                         # root: pnpm workspaces + turbo
├── apps/
│   ├── school-head/
│   │   ├── api/
│   │   │   ├── index.js           # Express entry — mounts 16 routers + siifRouter
│   │   │   ├── units/unit1..unit9/index.js
│   │   │   ├── units/auth/{login.js,registration.js}
│   │   │   └── units/{push,docs,dashboard,location,settings,chat}/index.js
│   │   └── web/
│   │       └── src/
│   │           ├── App.jsx                     # shell, router, providers
│   │           ├── lib/api.js                  # api(path) base-URL helper
│   │           ├── db.js                        # IndexedDB (idb) offline store
│   │           ├── sw.js                        # service worker (injectManifest)
│   │           ├── context/{AuthContext,ServiceWorkerContext,ThemeContext}.jsx
│   │           ├── config/{roleGroups.js,dashboardMetadata.js}
│   │           ├── constants/progressChecklists.js
│   │           ├── hooks/{useReadOnly.js,useHistoricalData.jsx}
│   │           ├── components/modular/Unit{1..7}*.jsx   # ⚠️ 200 KB+ wizards
│   │           ├── utils/{chunkedUploader,imageCompression,exif,submissionHelper,dataNormalization,PrintableExportGenerator,ReportGenerator}.js
│   │           └── modules/siif/                # SIIF frontend (see §6)
│   ├── siif/api/{index.js,routes/*,middleware/authenticate.js,helpers/resolveSchoolId.js}
│   └── esf7/                      # deferred STUB — README only; integrates via esf7_link table
└── packages/
    ├── shared-db/src/{db.js,db_init.js}     # pg Pool + all schema/migrations
    ├── shared-auth/src/authMiddleware.js    # DEFAULT export
    ├── shared-io/src/{helpers.js,binaryPipeline.js}
    ├── shared-types/                        # SIIF_STATUSES, SCHOOL_YEAR_DEFAULT
    └── shared-ui/                           # LoadingScreen, PageTransition
```

### `@shared/*` import map (use these, not relative paths)

| Alias | Resolves to | Key exports |
| --- | --- | --- |
| `@shared/db` | `packages/shared-db/src/db.js` | `pool`, `poolNew`, `safeQuery`, `cachedQuery`, `updateSchoolTotalCompletion` |
| `@shared/db/db_init` | `packages/shared-db/src/db_init.js` | `runMigrations`, `initOtpTable` |
| `@shared/auth` | `packages/shared-auth/src/authMiddleware.js` | **default** `authMiddleware` |
| `@shared/io` | `packages/shared-io/src/helpers.js` | `compressBufferTo90Dpi`, `upsertBinary`, `getUploadPath`, `memoryUpload`, `schoolDocsUpload`, `projectPhotosUpload`, `normalizeRole`, `transporter`, `blobServiceClient` |

---

## 3 · Task → Files (the routing table)

<aside>
🎯

Match the request to a row, open only those files. `SH` = school-head, `web` = `apps/school-head/web/src`.

</aside>

### Backend — data-collection Units

| Unit / concern | Endpoint | Backend file | Table(s) | Conflict key |
| --- | --- | --- | --- | --- |
| Unit 1 School Identity | `POST /api/ph_schools/unit1` | `SH/api/units/unit1/index.js` | `unit1_school_identity` (+`school_ownership_records`) | `(iern, school_yr)` |
| Unit 2 Learners | `PUT /api/ph_schools/unit2/:id` | `SH/api/units/unit2/index.js` | `unit2_school_learners` | `(iern, school_yr)` |
| Unit 3 Organized Classes | `PUT /api/ph_schools/unit3/:id` | `SH/api/units/unit3/index.js` | `unit3_organized_classes` | `(iern, school_yr)` |
| Unit 4 Learner Profile | `PUT /api/ph_schools/unit4/:id` | `SH/api/units/unit4/index.js` | `unit4_learner_profile` | `(iern, school_yr)` |
| Unit 5 Shifting/Modality | `PUT /api/ph_schools/unit5/:id` | `SH/api/units/unit5/index.js` | `unit5_shifting_modality` | `(iern, school_yr)` |
| Unit 6 School Resources | `PUT /api/ph_schools/unit6/:id` | `SH/api/units/unit6/index.js` | `unit6_school_resources` (+`unit6_furniture_grades`,`unit6_ecart_batches`) | `(school_id, school_yr)` |
| Unit 7 Facilities | `POST /api/save-physical-facilities` ⚠️ + `GET /api/ph_schools/unit7/:id/{master,facilities,spaces}` | `SH/api/units/unit7/index.js` | `unit7_buildings_inventory/_repairs/_demolition/_school_buildable_spaces`, `unit7_facilities` | `(iern, school_yr)` / `(iern, space_name, school_yr)` |
| Unit 8 Location | `GET`/`POST /api/school-location/:id?` | `SH/api/units/unit8/index.js` | `unit8_location` | `(school_id, school_yr)` |
| Unit 9 Safety | `GET`/`PUT /api/ph_schools/unit9/:id` | `SH/api/units/unit9/index.js` | `unit9_safety` (63 cols) | `(school_id, school_yr)` |

<aside>
⚠️

**Join rule (business-critical):** Units **1–5 join on `iern`**, Units **6–9 join on `school_id`**, and every join is filtered by `school_yr`. A unit is "complete" only if its row EXISTS for that school year.

</aside>

### Backend — platform routers

| Concern | Endpoints | File |
| --- | --- | --- |
| Login / register / PIN / profile / feedback | session/login, password, PIN, school-ID verify | `SH/api/units/auth/{login.js,registration.js}` |
| Dashboard / progress / monitoring | `PATCH /api/schools/:school_id/units/:n/complete`, `GET /api/ph_schools/progress/:schoolId`, `GET /api/monitoring/schools`, `GET /api/announcements/latest` | `SH/api/units/dashboard/index.js` |
| Document upload / asset serving | `POST /api/schools/:iern/ownership-docs`, `GET /api/asset/:id`, `DELETE .../ownership-docs/:id` | `SH/api/units/docs/index.js` |
| Location dropdowns / offline lists | `/api/locations/*`, `/api/lists/*`, `/api/offline/schools` (read `schools_IERN`) | `SH/api/units/location/index.js` |
| Settings / reference / health | `GET /api/settings/:key`, `/api/reference/*`, `/api/health`, `/api/pool-status` | `SH/api/units/settings/index.js` |
| Web-push notifications | `GET /api/vapid-public-key`, `POST /api/save-subscription`, `POST /api/broadcast-push` | `SH/api/units/push/index.js` |
| Chat (direct rooms) | `/api/chat/{contacts,room,rooms,rooms/:id/messages,messages,upload}` | `SH/api/units/chat/index.js` |
| Middleware / CORS / mounting / startup migrations / `autoCleanOldChats` | — | `SH/api/index.js` |

### Frontend — School Head PWA

| Concern | File(s) |
| --- | --- |
| App shell, routing, providers, maintenance poll | `web/App.jsx` |
| API base-URL resolution (`/insighted-schoolhead/api` vs `/api`) | `web/lib/api.js` |
| Auth / session / role state | `web/context/AuthContext.jsx` |
| Role gating, `normalizeRole`, `NEXUS_AUTHORIZED_EMAILS` | `web/config/roleGroups.js` |
| SY 25-26 read-only enforcement | `web/hooks/useReadOnly.js` |
| Offline queue / sync | `web/db.js`, `web/utils/submissionHelper.js`, `SyncCenter`, `web/sw.js` |
| Uploads (chunk/compress/exif) | `web/utils/{chunkedUploader,imageCompression,exif}.js` |
| Exports / printables | `web/utils/{PrintableExportGenerator,ReportGenerator}.js` |
| A specific unit's form UI | `web/components/modular/Unit{N}*.jsx` (open ONLY the one unit) |

---

## 4 · Database schema — single source of truth

- **All tables, columns, migrations, triggers, and RLS live in `packages/shared-db/src/db_init.js`** (`runMigrations()`, advisory lock `7777777`; Unit 8 uses `8888`). Migrations are idempotent (`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`).
- Central hub table: **`ph_schools`** — one row per school (`iern` PK, `school_id` UNIQUE); holds denormalized Unit 1–9 snapshot columns + per-unit flags `unit{1..9}`, `unit{1..9}_completed`, `unit{1..9}_updated_at`, rollups.
- Binary store: **`unified_binaries`** (`id` UUID, `hash` unique dedup, `content` BYTEA). Served via `GET /api/asset/:id`.
- **Nuclear Lock:** every base table has RLS + `fn_prevent_truncate()`/`fn_prevent_deletion()`. Legit deletes MUST wrap in a txn with `SET LOCAL internal.authorized_app_deletion = 'true'`.
- Read-only/external (do NOT create here): `schools_IERN` (canonical registry, quoted PascalCase cols), `esf7_link`, `ph_offices`.

---

## 5 · Cross-cutting concerns → where they live

| Concern | File | Note |
| --- | --- | --- |
| School-Year Lock (`403 LOCKED_SCHOOL_YEAR` on `SY 25-26` writes) | `SH/api/index.js` | Global middleware; active year `SY 26-27` |
| Admission control (503 on event-loop >400 ms / heap >950 MB) | `SH/api/index.js` | — |
| CORS allowlist | `SH/api/index.js` | localhost:5173/5174, Vercel, Render, `CORS_ORIGIN_VM` |
| DB retries / caching | `packages/shared-db/src/db.js` | `safeQuery` (retry), `cachedQuery` (90 s TTL) |
| Completion recompute (LEFT JOIN 9 unit tables) | `SH/api/units/dashboard/index.js` | `iern` for 1–5, `school_id` for 6–9, filtered by `school_yr` |
| PDF/image Hydra pipeline | `packages/shared-io/src/{helpers.js,binaryPipeline.js}` | `compressBufferTo90Dpi`, shards >25 MB via `upsertBinary` |
| Timestamp trigger | `db_init.js` | `update_unit_timestamp()` on `ph_schools` |

---

## 6 · SIIF sub-module

- **Mounting:** `SH/api/index.js` mounts `import siifRouter from '../../siif/api/index.js'` at **`app.use('/api/siif', siifRouter)`** (prefix required — SIIF routes declare relative paths).
- **Backend routes:** `apps/siif/api/routes/{allocation,submission,utilization,settings,monitoring,feedback,profile,system,health}.js` — all import `{ pool } from '@shared/db'`, guard with `authenticate` (`apps/siif/api/middleware/authenticate.js`), resolve school via `apps/siif/api/helpers/resolveSchoolId.js`.
- **Frontend:** `web/modules/siif/` — entry `SIIFModule.jsx`; pages `SIIFDashboard/FormsHub/Utilization/Summary/Settings`. **All fetches go through `web/modules/siif/services/siifService.js`** (no `fetch` in components; named exports only).
- **Endpoints:** `GET /api/siif/settings/deadline` (public), `GET /api/siif/allocation/:schoolId`, `GET /api/siif/submission/:schoolId`, `POST /api/siif/submit`, `POST /api/siif/utilization`.
- **Tables:** `siif_allocations`, `siif_submissions`, `siif_interventions`, `siif_beneficiaries`, `siif_activities`, `siif_utilization`, `settings`. Statuses from `@shared/types` `SIIF_STATUSES` = DRAFT / SUBMITTED / APPROVED / REJECTED.

---

## 7 · Known quirks (check before "fixing")

- **Unit 6** DB column is literally `unit7_has_ecart` (schema-defined; INSERT `$46` + ON CONFLICT). Renaming needs a migration → do not touch without approval.
- **Unit 7 stragglers:** `GET /api/unit8/teachers/:id` (mislabeled — it's a Unit 7 route reading `ph_teachers_list`) and non-namespaced `POST /api/save-physical-facilities` (the MAIN Unit 7 save).
- Frontend may still send dead flat `u7_*` fields that no router reads — safe to ignore, remove only if the task says so.
- Sharded (>25 MB Hydra) docs: `GET /api/asset/:id` returns a single row; multi-shard reassembly is unverified.
- `apps/esf7` is an intentional stub — never route work there; use `esf7_link` table + `is_esf7_opened` flag.

---

## 8 · Golden rules for revisions

<aside>
🛑

1. **Do NOT change endpoints, route paths, or DB schema/columns** unless the task explicitly requires it (schema changes need a `db_init.js` migration + approval).
2. **Do NOT guess** file contents — this map tells you which file to open; open it and read the real code before editing.
3. **Preserve business logic:** the `iern` (Units 1–5) vs `school_id` (Units 6–9) + `school_yr` join/completion rules are load-bearing.
4. **Use `@shared/*` aliases**, never relative `../../utils/db.js` (that path does not exist).
5. **Deletes require** the `SET LOCAL internal.authorized_app_deletion='true'` bypass inside a transaction.
6. **Frontend fetch discipline:** School Head uses `api()` from `lib/api.js`; SIIF uses `siifService.js` — no raw `fetch` in components.
</aside>

---

## 9 · Prompt starter for the agent

> Use `.agent/CODEMAP.md` §3 to locate files for this task. Open only the listed file(s) plus `db_init.js` if schema is involved. Do not scan the tree or read full `Unit*.jsx` wizards. Follow §8 Golden rules. Confirm the target file path against §2 before editing.
>