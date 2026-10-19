# Implementation Plan: SIIF Is Locked in Production but Not Locally

**Branch:** `feature/siif-optional-forms`
**Related:** [docs/siif-unlock/implementation_plan.md](../siif-unlock/implementation_plan.md), [docs/siif-nexus-lock/implementation_plan.md](../siif-nexus-lock/implementation_plan.md)

---

## 1. Short answer

Your local machine **skips the database check**. Production **reads the database**. They behave differently because of a local-only file, not because of the code.

| | Local (`pnpm dev`) | Production (built bundle) |
|---|---|---|
| `apps/school-head/web/.env.local` has `VITE_SIIF_DEV_UNLOCK=true` | Read by Vite dev | **Not shipped and not read.** The `*.local` file is git-ignored, and `import.meta.env.DEV` is `false` in a build. |
| SIIF lock decision | Always **unlocked**, and the DB is never asked | Taken from `settings.nexus_module_locks` → `"siif"` |

So **local being unlocked tells you nothing about the database.** Local would be unlocked even if the DB said `"siif": true`.

## 2. The code that decides the lock (all of it)

| Layer | File | Rule |
|---|---|---|
| Nexus card | [NexusDashboard.jsx:181](../../apps/school-head/web/src/modules/NexusDashboard.jsx#L181) | `SIIF_DEV_UNLOCK ? false : (locks has 'siif' ? Boolean(locks.siif) : true)` |
| Route guard | [SIIFModule.jsx:43-75](../../apps/siif/web/src/SIIFModule.jsx#L43-L75) | Bypass for Admin / SDO / RO roles, `?preview=true`, or dev unlock. Otherwise **fail-closed**: locked on any fetch error, parse error, or missing key. |
| API | [settings/index.js:11-34](../../apps/school-head/api/units/settings/index.js#L11-L34) | `SELECT value FROM settings WHERE key='nexus_module_locks'`. If the row is missing **or the query errors**, it returns a hard-coded `"siif": true`. |
| Boot seed | [db_init.js:550-552](../../packages/shared-db/src/db_init.js#L550-L552) | Inserts `"siif": true` **only if the row is missing** (`ON CONFLICT DO NOTHING`). It never overwrites your edit. |

**Nothing in the code re-locks SIIF after you change it.** The boot seed doesn't overwrite an existing row, and the only writer is the Admin Dashboard's `POST /api/settings/save`.

> Meaning of the value: `"siif": true` = **locked**, `"siif": false` = **open**.

## 3. Most likely cause: you edited a different database

The settings API uses `pool`, which is built from [db.js:17](../../packages/shared-db/src/db.js#L17):

```js
process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL || <hard-coded fallback>
```

Your `.env` has `CLOUD_DATABASE_URL` → **`cloud_database`**. That means the lock is read from **`cloud_database.settings`**, **not `insightEd`**.

If you changed the row in `insightEd` (or `insighted-staging` / `siif_database_v2`), production never sees it.

> **Update (confirmed in code):** the lock was edited in `siif_database_v2.settings`, and the card stayed locked after a redeploy. No code reads `nexus_module_locks` from `siif_database_v2`. The SIIF API (`poolSiif`) only reads `siif_form_start`, `siif_form_end` and the utilization quarter keys from that database. The Nexus card and the route guard call `GET /api/settings/nexus_module_locks`. That request goes to `settingsRouter` (school-head `index.js:241`), then `safeQuery`, then `pool`, then **`cloud_database`**. `db.js` only rewrites `/insighted` URLs, and only when not in production. **Fix: change the row in `cloud_database`.**

### Hypotheses, ranked

| # | Hypothesis | How to check |
|---|---|---|
| H1 | The edit went to `insightEd`, but the app reads `cloud_database` | Run query Q1 below on `cloud_database` |
| H2 | The value was saved as a string, e.g. `"siif": "false"`. `Boolean("false")` is **`true`**, so it stays locked | Look at Q1's output: it must be `false` with no quotes |
| H3 | The JSON is invalid (a typo or trailing comma), so `JSON.parse` fails and the guard fails closed | Q1 + `SELECT value::jsonb` succeeds |
| H4 | The prod API errors on the query, so the catch block returns `"siif": true` | `pm2 logs insighted-schoolhead-backend` on the server, and `curl` the endpoint (Q2) |
| H5 | You're testing as a School Head and expecting the Admin bypass (or the other way round) | Check which role you logged in with |

## 4. Your `.env` questions

**What does local use?**
- Backend: the root `.env`. Every DB URL in it points to the **production** Postgres server (`stride-posgre-prod-01`): `cloud_database`, `siif_database_v2`, `users_database`, `insighted-staging`. `NODE_ENV=development`.
- Frontend: `apps/school-head/web/.env.local` (only `VITE_SIIF_DEV_UNLOCK=true`).

**Does production read your `.env`?** **Yes.** `deploy_schoolhead_prod.py` puts `.env` in `INCLUDE` (line 27), packs it into the tarball, and extracts it on the server. `db.js` loads it with `dotenv`. The only override is PM2 (`ecosystem.schoolhead.config.cjs`), which sets `NODE_ENV=production` and `PORT`. dotenv doesn't overwrite variables that are already set, so PM2's values win for those two.
- So local and prod hit **the same databases**. That's why H1 matters: if the lock really is false in `cloud_database`, prod should be open.
- `.env.local` is **not** shipped, and it would be ignored anyway because `DEV` is `false` in a build.

## 5. Plan

### Phase 1: Confirm (read-only, you run it, 5 min)
I was blocked from querying production directly, so please run these yourself:

**Q1** (connect to **`cloud_database`**):
```sql
SELECT value, value::jsonb -> 'siif' AS siif, jsonb_typeof(value::jsonb -> 'siif') AS siif_type, updated_at
FROM settings WHERE key = 'nexus_module_locks';
```
Expected for "open": `siif = false`, `siif_type = boolean`.

**Q2** (on the prod server, no browser cache involved):
```bash
curl -s http://127.0.0.1:5010/api/settings/nexus_module_locks
```
This is exactly what production sees. If it says `"siif":true`, the problem is the DB or the API, not the frontend.

### Phase 2: Fix (no code change for H1–H3)
Set the value **in `cloud_database`**, as a real boolean, keeping the other keys:
```sql
UPDATE settings
SET value = (value::jsonb || '{"siif": false}')::text, updated_at = NOW()
WHERE key = 'nexus_module_locks';
```
Or use the Admin Dashboard toggle, which writes through the same `pool`, so it always hits the right DB. Then hard-refresh the browser.

### Phase 3: Hardening (optional code changes, need your OK)
1. **API returns what it read:** log `current_database()` at boot next to the settings pool so "which DB?" is answerable from `pm2 logs`.
2. **Strict boolean parse:** in `NexusDashboard.jsx` and `SIIFModule.jsx`, use `locks.siif !== false` instead of `Boolean(locks.siif)`, so `"false"` strings can't silently lock (H2). It stays fail-closed.
3. **API errors visible:** in `settings/index.js`, `console.error` before falling back to `"siif": true`, so H4 is no longer silent.

### Phase 4: Security notes found during the audit (needs your decision)
- 🔴 [db.js:17, 120, 209](../../packages/shared-db/src/db.js#L17) hard-code the **production DB username and password** as fallbacks, and they are committed to git. Recommend: remove the fallbacks (fail fast like `SIIF_DATABASE_URL` already does) and **rotate the password**, since it's in git history.
- 🟠 Local dev writes to **production** databases. A separate local/staging DB would stop test data leaking into prod. (Already raised in [docs/staging/implementation_plan.md](../staging/implementation_plan.md).)
- 🟡 `.env` has `INSIGHTED_STAGING_URL==postgres://…` (a double `=`). The value starts with `=`, so it's an invalid URL. Fix the typo.

## 6. Decisions for you
1. Run Q1 / Q2 and tell me the output. Or allow me to run Q1 read-only.
2. Should I apply the Phase 3 hardening?
3. Phase 4: remove the hard-coded credentials and rotate the password?
