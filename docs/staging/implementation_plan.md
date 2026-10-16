# SchoolHead Staging Server — Implementation Plan

**Goal:** Test the new SIIF changes (branch `feature/siif-optional-forms`) on the real server before they go to production.
**Staging URL:** `https://stride.deped.gov.ph/insighted-schoolhead-staging/`
**Status:** 🟡 Plan only — waiting for your decisions in **Section 6** before anything is built or deployed.

---

## 1. The Big Picture (in one diagram)

```
 YOUR LAPTOP                                  SERVER 20.24.58.49
 ───────────                                  ──────────────────
 py deploy_schoolhead_staging.py
   │
   ├─ 1. Preflight checks (SSH ok? port ok? files ok?)
   ├─ 2. Build frontend with base /insighted-schoolhead-staging/
   ├─ 3. Pack ONE tarball  ─────────────────►  /mnt/insighted-schoolhead-staging/
   │                                             ├── releases/
   │                                             │     ├── 20261012-0930/   ← new
   │                                             │     └── 20261010-1400/   ← previous (rollback)
   │                                             ├── current  → releases/20261012-0930
   │                                             ├── dist     → current/dist   (Nginx serves this)
   │                                             ├── uploads/  (staging-only uploads)
   │                                             └── logs/
   ├─ 4. Remote: extract → pnpm install → switch `current` → restart ONLY staging PM2
   └─ 5. Health checks (loopback + public URL + SIIF route) and show last log lines

 Nginx (ALREADY CONFIGURED — we will NOT touch it):
   /insighted-schoolhead-staging/      → /mnt/insighted-schoolhead-staging/dist/
   /insighted-schoolhead-staging/api/  → 127.0.0.1:5020  (upstream schoolhead_staging_backend)
```

Production stays exactly where it is:
`/var/www/html/InsightED-SchoolHead/insighted-schoolhead` → PM2 `insighted-schoolhead-backend` → port **5010**.

---

## 2. What I Found (Discovery Results)

| # | Finding | Why it matters |
|---|---------|----------------|
| ✅ 1 | Nginx **already has** a `/insighted-schoolhead-staging/` block pointing to `/mnt/insighted-schoolhead-staging/dist/` and port **5020**. | No Nginx edits needed. Zero risk to other sites. |
| ✅ 2 | `/mnt` has **533 GB free**. Port **5020 is free**. Node 20, pnpm 10, PM2 6 are installed. | Server is ready. |
| ✅ 3 | SIIF backend is mounted *inside* the SchoolHead API (`/api/siif`), and SIIF frontend is bundled *inside* the SchoolHead web build. | Staging needs only **1 backend + 1 frontend**. |
| ⚠️ 4 | Root disk `/` is **95% full** (1.7 GB left). | Staging must keep everything (pnpm store, logs, temp) on `/mnt`, never `/`. |
| 🔴 5 | **The backend runs DB migrations automatically on startup** (`runMigrations` in `apps/school-head/api/index.js`). This branch changed `db_init.js` by ~1,500 lines, including `ALTER TABLE ph_schools` and non-concurrent `CREATE INDEX` on `ph_schools`. | If staging connects to the **production DB**, simply starting staging would run these migrations on production — possibly locking `ph_schools` (every route depends on it). |
| 🔴 6 | Your `.env` points **all 5 databases** to the production Postgres (`stride-posgre-prod-01`), incl. `siif_database_v2`. | Any SIIF form you submit on staging becomes **real production data**, and because of the deletion lock it **cannot be easily cleaned up**. |
| 🔴 7 | The backend also runs `autoCleanOldChats()` (deletes old chats) on startup + every 24h. | A second copy (staging) would run this job too, against the shared chat DB. |
| ⚠️ 8 | `ecosystem.schoolhead-staging.config.cjs` is **misnamed** — it actually launches the *production* process name `insighted-schoolhead-backend` on port **5010**. The old `deploy_schoolhead_staging.py` uses it. | Running the old staging script could **replace the production process**. Must be fixed before use. |
| ⚠️ 9 | None of the local deploy scripts target the *real* production folder (`/var/www/html/InsightED-SchoolHead/...`). `deploy-schoolhead-v3.py` targets `/mnt/www/...` which is empty. | I'll mirror the **style** of `deploy-schoolhead-v3.py` (latest), but please confirm which script you really use for prod (see Section 6). |

---

## 3. The Plan — Step by Step

### Step 1 — Make staging safe to boot (small code change)
Add two **opt-in** env flags in `apps/school-head/api/index.js`. Production behavior does **not** change (flags are off by default).

| Flag | Effect when `true` |
|------|--------------------|
| `SKIP_BOOT_MIGRATIONS` | Skip `initOtpTable` / `runMigrations` / `initChatSchema` on startup. |
| `DISABLE_CHAT_CLEANUP` | Skip the `autoCleanOldChats()` startup + 24h job. |

Staging will always run with both set to `true`.

### Step 2 — Create a staging-only env file: `.env.staging` (git-ignored)
Copied from `.env`, then changed:

```
NODE_ENV=production
PORT=5020
SKIP_BOOT_MIGRATIONS=true
DISABLE_CHAT_CLEANUP=true
UPLOAD_DIR=/mnt/insighted-schoolhead-staging/uploads
DATABASE_URL / SIIF_DATABASE_URL / ...   ← depends on your decision (Section 6, Q1)
```

The deploy script will **refuse to run** if `.env.staging` is missing or if `PORT` ≠ 5020.

### Step 3 — Fix the PM2 config: `ecosystem.schoolhead-staging.config.cjs`
Rewrite it so it is truly staging:

| Setting | Value |
|---------|-------|
| name | `insighted-schoolhead-staging-backend` |
| script | `apps/school-head/api/index.js` |
| cwd | `/mnt/insighted-schoolhead-staging/current` |
| port | `5020` |
| mode | `fork`, 1 instance (staging doesn't need 2; saves RAM) |
| memory limit | `1G` restart |
| logs | `/mnt/insighted-schoolhead-staging/logs/` |

### Step 4 — Create the server folder (one-time, done by the script)
```
/mnt/insighted-schoolhead-staging/{releases,uploads,logs}
```

### Step 5 — Write the new `deploy_schoolhead_staging.py`
Replaces the old (unsafe) one. Same style as `deploy-schoolhead-v3.py` (colored output, retries, SSH keepalive, single tarball streamed over SSH), plus the safety rules from `.agent/deploy.md`.

| Phase | What it does | Stops if… |
|-------|--------------|-----------|
| **0. Preflight** | Prints branch + commit; checks `.env.staging`, PM2 config, SSH (`BatchMode`), that port 5020 is free **or** owned by the staging process. | Any check fails. Nothing on the server is touched yet. |
| **1. Build** | `VITE_BASE_PATH=/insighted-schoolhead-staging/`, `VITE_APP_VERSION=staging-<commit>-<time>`; runs `pnpm --filter @apps/school-head-web build`; verifies `index.html` references `/insighted-schoolhead-staging/assets/...`. | Build fails or wrong base path. |
| **2. Package** | One `.tar.gz`: backend (`apps/school-head/api`, `apps/siif/api`), `packages/shared-*`, `dist`, lockfiles, PM2 config, `.env.staging` → packed as `.env`. | Required path missing. |
| **3. Upload** | Streams the tarball to `/mnt/insighted-schoolhead-staging/releases/`. | Upload fails after retries. |
| **4. Activate** | Extract into a new `releases/<timestamp>/` → `pnpm install --prod --frozen-lockfile` (store on `/mnt/.pnpm-store`) → point `current` + `dist` symlinks at it → `pm2 delete` + `pm2 start` **only** `insighted-schoolhead-staging-backend`. Keeps the last 3 releases. | Install fails → `current` is **not** switched, staging keeps old version. |
| **5. Verify** | `curl 127.0.0.1:5020/api/ping`, `/api/siif/health`, public URL + one JS asset (expect 200); shows PM2 status + last 30 log lines. | Health fails → auto-rollback to previous release. |

**Extra commands:**
```
py deploy_schoolhead_staging.py              # normal deploy
py deploy_schoolhead_staging.py --check      # preflight only, changes nothing
py deploy_schoolhead_staging.py --rollback   # switch back to previous release
py deploy_schoolhead_staging.py --logs       # show staging PM2 logs
```

### Step 6 — First deploy + SIIF testing
1. Run `--check`, then a normal deploy.
2. Open the staging URL, log in as a School Head, go through the SIIF flows (Dashboard, Utilization, optional forms).
3. Confirm production (`/insighted-schoolhead/`) is untouched: PM2 `insighted-schoolhead-backend` restart count unchanged.

---

## 4. Safety Guardrails (what the script will NEVER do)

- ❌ Never touch Nginx config or reload Nginx.
- ❌ Never touch `/var/www/html/...` (production) or any other `/mnt/*` app.
- ❌ Never run `pm2 restart all`, `pm2 reload all`, `pm2 save`-over-others, or touch any PM2 process except `insighted-schoolhead-staging-backend`.
- ❌ Never run migrations, seeds, `DELETE`, `TRUNCATE`, or anything near the deletion-lock triggers.
- ❌ Never write to the root disk `/` (95% full).
- ✅ Hard-coded guard: script aborts if the remote path isn't exactly `/mnt/insighted-schoolhead-staging`.

---

## 5. Files That Will Change

| File | Change |
|------|--------|
| `apps/school-head/api/index.js` | + `SKIP_BOOT_MIGRATIONS` / `DISABLE_CHAT_CLEANUP` flags (≈6 lines) |
| `ecosystem.schoolhead-staging.config.cjs` | Rewritten as real staging config (port 5020) |
| `deploy_schoolhead_staging.py` | Rewritten (new staging pipeline) |
| `.env.staging` | **New, git-ignored** — never committed |
| `.gitignore` | + `.env.staging`, `*.tar.gz` |
| `docs/staging/README.md` | Short "how to deploy to staging" guide |

---

## 6. ❓ Decisions I Need From You

**Q1 — Which database should staging use? (most important)**

| Option | How | Pros | Cons |
|--------|-----|------|------|
| **A. Separate staging DB copies** ⭐ *recommended* | Create copies (e.g. `cloud_database_staging`, `siif_database_staging`) on the same Azure server; point `.env.staging` to them. Small code tweak: allow `SIIF_DB_NAME` override (db.js currently only accepts the name `siif_database_v2`). | 100% safe. Test SIIF submissions freely. Migrations can be tested too. | Takes time to copy; data is a snapshot. |
| **B. Shared prod DB, migrations OFF** | Use prod URLs, with `SKIP_BOOT_MIGRATIONS=true`. | Fast; real data. | Every SIIF test submission = **real prod data** that can't be deleted (deletion lock). Can't test the new migrations. |
| **C. Hybrid** | Prod DB for main/users (read-mostly), **staging copy only for SIIF DB**. | Real school data + safe SIIF testing. | Still need one DB copy; cross-DB data may drift. |

**Q2 — Which script do you actually use to deploy production?**
The live prod folder is `/var/www/html/InsightED-SchoolHead/insighted-schoolhead`, but no local script targets it. Is there another script (maybe on another machine), or do you deploy manually? I'll align staging to whatever is real.

**Q3 — OK to replace the old `deploy_schoolhead_staging.py` and fix the misnamed PM2 config?** (Both are unsafe as-is, see Finding #8.)

**Q4 — Who should access staging?** It will be public at the staging URL. Do you want it restricted (e.g., Nginx basic auth — would require a one-time Nginx edit you approve), or is "unlisted URL" fine?

---

## 6b. ✅ Database Decision: use `insighted-staging` (updated 2026-10-12)

### What the read-only comparison found

| Check | Result |
|-------|--------|
| Prod `siif_database_v2` | 39 objects (29 tables + 10 views), ~213 MB, e.g. `siif_beneficiaries` 539,598 rows, `siif_activities` 378,402 rows |
| `insighted-staging` | **Shared** staging DB: 138 tables used by other staging apps |
| `siif_*` tables in staging `public` | Stats showed 0 rows, but an exact count found **2,360** in `siif_submissions`. They are left untouched. |
| Missing in staging | 7 tables (`modified_siif_utilization`, `_audit`, `siif_submissions_archive`, `schools_ierntemp`, `user_schoolhead_temp`, `deped_staffing_*`) + 9 views (`vw_siif_division_*`, `v_modified_siif_interventions`) |
| Missing columns | `siif_submissions.form_completion_percentage / for_revision / revision_remarks`, `siif_allocations.is_testaccount`, `users.failed_attempts / locked_until / last_login_at / last_password_change_at / updated_at` |
| Type differences | ~120 columns: prod uses loose types (`text`, `int8`, `float8`, nullable); staging uses strict types (`uuid`, `timestamptz`, `bool`, `numeric`, NOT NULL) |
| Shared non-SIIF tables | 13 prod tables also exist in staging and **other staging apps use them**: `users`, `chat_*`, `notifications`, `verification_codes`, `activity_logs`, `settings`, … |
| Deletion lock in staging | 126 tables have FORCE RLS + `trg_block_truncate_*` / `trg_prevent_deletion_*` |

### Why not modify staging's `public` tables directly
Making `public` identical to prod would mean changing ~120 column types and overwriting `users`, `chat_*`, `verification_codes`, etc. Those tables belong to **other staging apps**, which would break. It would also mean working against the deletion lock.

### ⭐ Recommended: a dedicated `siif_staging_v2` schema inside `insighted-staging`
A **schema** is a separate folder inside the same database.

```
insighted-staging (database)
├── public/     ← untouched (other staging apps keep working)
└── siif_staging_v2/ ← NEW: exact copy of prod siif_database_v2
      ├── 29 tables  (same columns, types, PKs, unique keys, indexes, sequences)
      ├── 10 views   (created in dependency order)
      └── all rows   (~1.1M rows copied with COPY streaming)
```

- **Identical to prod:** structure is read from prod's catalog and re-created exactly; data is copied table by table; row counts are verified at the end.
- **Nothing existing is touched:** no TRUNCATE, no ALTER on `public`, no lock bypass.
- **No SIIF code changes:** all SIIF routes use `poolSiif` with unqualified table names, so staging just connects with `search_path=siif_staging_v2`.
- **Re-runnable:** `node scripts/staging/sync_staging_db.cjs` refreshes staging from prod at any time. It rebuilds **only** `siif_staging_v2`, and the prod connection is opened **read-only**.

Required code tweak (`packages/shared-db/src/db.js`): let `SIIF_DB_NAME` be overridden by env (default stays `siif_database_v2`). Staging's `.env.staging` then uses:
```
SIIF_DB_NAME=insighted-staging
SIIF_DATABASE_URL=postgres://…/insighted-staging?options=-c%20search_path%3Dsiif_staging_v2
DATABASE_URL=postgres://…/insighted-staging
```

### Still open
- **Q5 — `USERS_DATABASE_URL`:** SIIF's profile page **writes** to `users_database.user_schoolhead`. Logins also use it. Keep prod users (real logins work, but profile edits on staging change real accounts) or point it to a staging copy?
- **Q6 — Personal data:** prod `users` (103 rows) holds emails and password hashes. Copy as-is (identical), or blank them out in staging?

---

## 7. Side Notes (not blocking, but worth fixing later)

- `packages/shared-db/src/db.js` has **hard-coded DB passwords** as fallbacks — should be removed and rotated.
- The production PM2 config on the server has a **hard-coded `JWT_SECRET`** — should move to `.env`.
- Your local `.env` has a few stray lines that aren't `KEY=value` (an IP and credentials) — they should be removed.
- Because local `.env` points to prod DBs, running the API locally may **already** have applied this branch's migrations to production. Worth checking before the prod release.
