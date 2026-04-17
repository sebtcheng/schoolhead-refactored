# SYSTEM ROLE
You are an expert full-stack engineer (Node.js / PostgreSQL / Express 5) operating inside the **InsightEd Mobile PWA** codebase. Your goal is to surgically eliminate seven identified PostgreSQL bottleneck risks on the Division Engineer data path. All changes must be **additive and non-breaking** — no route signatures change, no existing data is altered, no frontend changes are needed. Follow each step in strict order and mark each sub-step complete before advancing.

---

# 🌌 THE VIBE & AESTHETIC
This is a **precision infrastructure fix**, not a feature build. The aesthetic is zero-downtime surgical precision — like a hot-patch on a live production server. Every change must be idempotent, reversible, and observable. Think pit-crew efficiency: get in, fix the specific failure point, get out. No speculative abstractions, no refactors beyond the seven risks catalogued below.

---

# 🛠️ TECH STACK & ARCHITECTURE
- **Backend:** Express 5.2, Node.js, `pg` (node-postgres pool)
- **Database:** Azure PostgreSQL (routed via PgBouncer on port 6432)
- **Key Files:**
  - `api/index.js` — all route handlers (~21,000 lines); this is the **only** file that needs logic changes
  - `api/db_init.js` — boot-level schema migrations; this is where **all new indexes** must be declared
- **Constraints:**
  - ALL schema changes (indexes, columns) go in `api/db_init.js` boot migrations — NEVER in route handlers
  - Use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` for any new index to avoid `AccessExclusiveLock` during deploy
  - Advisory lock (`pg_try_advisory_lock`) is already in place in `db_init.js` — do not disturb it
  - Do not alter JWT signing logic or the `authMiddleware.js` without explicit instruction
  - `pool.query` is the correct DB interface throughout — do not introduce Knex or raw client in routes

---

# 📝 CORE REQUIREMENTS

1. **Eliminate the per-request user-profile round-trip** on `/api/projects` and `/api/dashboard/efd-summary` by reading user metadata from the JWT payload (`req.user`) rather than issuing a separate `SELECT` against the `users` table.
2. **Add the missing JWT fields** (`region`, `division`) to the token signed at login so the round-trip elimination is possible.
3. **Add missing B-tree indexes** on `engineer_form` hot columns (`region`, `division`, `engineer_id`, `project_category`, `funding_year`) in `db_init.js`.
4. **Replace `regexp_replace + ILIKE` division filtering** with a normalized `LOWER(TRIM(...))` equality check that can leverage the new index.
5. **Collapse the N+1 correlated `imagesCount` subquery** into the `RankedProjects` CTE as a single LEFT JOIN aggregate.
6. **Eliminate the double CTE execution** (count query + data query) by using `COUNT(*) OVER()` in a single query pass.
7. **Add a composite index** on `engineer_documents(ipc, created_at DESC)` to support the LATERAL join sort without a per-row filesort.

---

# 🚀 STEP-BY-STEP EXECUTION PLAN

> Follow these steps in strict order. Do not advance until all sub-steps in a step are complete and logically verified.

---

## Step 1: Extend the JWT Payload with `region` and `division`

**Context:** `api/index.js` contains two login endpoints that call `jwt.sign(...)`. Currently, the payload only includes `{ uid, email, role }`. The `region` and `division` fields are present in the `user` row at that point but are not signed into the token.

- **1a:** Locate ALL `jwt.sign(...)` calls in `api/index.js` (search for `jwt.sign(`). There are at least two: the migrate-login endpoint and the standard login endpoint.
- **1b:** In each `jwt.sign(...)` call, add `region: user.region || null` and `division: user.division || null` to the payload object. Do not change `expiresIn` or the secret.
- **1c:** Verify that `authMiddleware.js` (`api/middleware/authMiddleware.js`) attaches the full decoded payload to `req.user` — it should already do this. Confirm the fields will be accessible as `req.user.region` and `req.user.division` after this change.

---

## Step 2: Remove the Redundant User-Profile Lookup from Both Endpoints

**Context:** Both `/api/dashboard/efd-summary` (line ~11196) and `/api/projects` (line ~11445) contain:
```js
const userResult = await pool.query('SELECT role, region, division FROM users WHERE uid = $1', [engineer_id]);
const userProfile = userResult.rows[0];
```
This is a wasted round-trip because the auth middleware has already decoded the same data from the JWT.

- **2a:** In `/api/dashboard/efd-summary`, remove the `pool.query('SELECT role, region, division...')` call. Replace `userProfile.role` with `req.user?.role`, `userProfile.region` with `req.user?.region`, and `userProfile.division` with `req.user?.division`. The `engineer_id` param is still used for the non-jurisdiction-restricted branch — keep that logic intact.
- **2b:** In `/api/projects`, apply the identical substitution. The `isAdmin` and `isJurisdictionRestricted` arrays are referenced by `role` — ensure `role` is still derived as `req.user?.role?.trim().toLowerCase()`.
- **2c:** For the case where `engineer_id` is provided but `req.user` is undefined (unauthenticated edge case), add a guard: `if (!req.user) return res.status(401).json({ error: 'Unauthorized' });` at the top of each handler before the filter-building block.

---

## Step 3: Add Missing Indexes in `db_init.js`

**Context:** `engineer_form` has only one non-primary index (`idx_engineer_form_ipc_partial` on `ipc`). The jurisdiction filter, engineer filter, and EFD summary aggregations all run sequential scans because the critical columns are unindexed.

- **3a:** In `api/db_init.js`, locate the block where `idx_engineer_form_ipc_partial` is created (line ~1591). Directly after it, add the following index creation statements using `CREATE INDEX CONCURRENTLY IF NOT EXISTS`:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_region
  ON engineer_form (LOWER(TRIM(region)));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_division
  ON engineer_form (LOWER(TRIM(division)));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_region_div
  ON engineer_form (LOWER(TRIM(region)), LOWER(TRIM(division)));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_engineer_id
  ON engineer_form (engineer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_category
  ON engineer_form (project_category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_form_year
  ON engineer_form (funding_year);
```

- **3b:** In the same `db_init.js` file, find where `idx_engineer_documents_ipc` is created (line ~1588). Add directly after it:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engineer_docs_ipc_created
  ON engineer_documents (ipc, created_at DESC)
  WHERE ipc IS NOT NULL;
```

- **3c:** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Verify the surrounding `db_init.js` code uses a plain `client.query(...)` call (not inside `BEGIN`/`COMMIT`) for these index statements. If the surrounding block is transactional, extract these six statements into a separate non-transactional boot step that runs after the transaction completes.

---

## Step 4: Replace `regexp_replace + ILIKE` Division Filter with Normalized Equality

**Context:** The division filter in both endpoints wraps the column in `regexp_replace(TRIM(e.division), '^(SDO|Division of)[-\s]+', '', 'i')` which defeats the new index from Step 3.

- **4a:** In the jurisdiction-filter block of `/api/projects` (line ~11462–11468), replace:
```js
const normalizedDivision = userProfile.division.trim().replace(/^(SDO|Division of)[-\s]+/i, '').trim();
queryParams.push(normalizedDivision);
whereClauses.push(`regexp_replace(TRIM(p.division), '^(SDO|Division of)[-\\s]+', '', 'i') ILIKE $${queryParams.length}`);
```
With:
```js
const normalizedDivision = req.user.division.trim().replace(/^(SDO|Division of)[-\s]+/i, '').trim().toLowerCase();
queryParams.push(normalizedDivision);
whereClauses.push(`LOWER(TRIM(regexp_replace(p.division, '^(SDO|Division of)[-\\s]+', '', 'i'))) = $${queryParams.length}`);
```
> **Note:** We normalize the *parameter* in JS and use a one-time `regexp_replace` on the DB side only to handle legacy stored values that weren't normalized at write time. The functional index `idx_engineer_form_division` on `LOWER(TRIM(division))` will not be used for `regexp_replace` expressions — this is an acceptable trade-off until a write-time normalization migration is run. For rows already storing normalized values (e.g. `Benguet` not `SDO Benguet`), the index is hit. Document this for future cleanup.

- **4b:** Apply the identical substitution in `/api/dashboard/efd-summary` (line ~11211–11213).

- **4c:** For the query-param `division` filter (line ~11241–11244 in `efd-summary` and ~11502–11505 in `projects`), apply the same pattern: normalize in JS, use `LOWER(TRIM(...))` equality on the DB side.

---

## Step 5: Collapse the N+1 `imagesCount` Subquery

**Context:** The final SELECT in `/api/projects` contains a correlated subquery (line ~11439):
```sql
(SELECT COUNT(*) FROM engineer_image ei WHERE ei.ipc = p.ipc OR ei.project_id = p.project_id) AS "imagesCount"
```
This fires one extra DB query per result row.

- **5a:** Inside the `RankedProjects` CTE in the `/api/projects` SQL string (line ~11346), add a new LEFT JOIN before the `FROM engineer_form e` closes:
```sql
LEFT JOIN (
    SELECT ipc, COUNT(*) AS img_count
    FROM engineer_image
    WHERE ipc IS NOT NULL
    GROUP BY ipc
) img_agg ON img_agg.ipc = e.ipc
```
Include `COALESCE(img_agg.img_count, 0) AS images_count` in the `RankedProjects` SELECT column list.

- **5b:** In the outer `LatestProjects` CTE (`SELECT * FROM RankedProjects WHERE rn = 1`), the `images_count` column is automatically included via `SELECT *`.

- **5c:** In the final `SELECT ... FROM LatestProjects p` block, replace:
```sql
(SELECT COUNT(*) FROM engineer_image ei WHERE ei.ipc = p.ipc OR ei.project_id = p.project_id) AS "imagesCount"
```
With:
```sql
p.images_count AS "imagesCount"
```

---

## Step 6: Eliminate the Double CTE Execution with `COUNT(*) OVER()`

**Context:** Lines 11610–11621 execute the full CTE twice: once for `COUNT(*)` and once for data.

- **6a:** Remove the separate `countSql` query and its `await pool.query(countSql, ...)` call entirely (lines 11610–11612).

- **6b:** In the final SELECT of the SQL string (the `SELECT ... FROM LatestProjects p` block), add `COUNT(*) OVER() AS total_count` to the column list.

- **6c:** After the single `await pool.query(sql, queryParams)` call, derive the total:
```js
const totalCount = parseInt(result.rows[0]?.total_count ?? 0, 10);
```

- **6d:** Keep the existing `res.json({ data: result.rows, pagination: { ... } })` structure identical. The `total_count` column will appear on every row object — strip it before sending: `result.rows.forEach(r => delete r.total_count);` before the `res.json(...)` call.

- **6e:** Handle the edge case where `result.rows` is empty (no projects): `totalCount` defaults to `0` correctly via the `?? 0` fallback.

---

# 🐛 DIAGNOSTIC & DEBUGGING SCRIPT

After all steps are implemented, add the following diagnostic block at the **top** of both modified route handlers (`/api/projects` and `/api/dashboard/efd-summary`), gated by `DEBUG_MODE`:

```js
const DEBUG_MODE = process.env.NODE_ENV !== 'production';

// [DIAG] Division Engineer Query Telemetry
if (DEBUG_MODE && engineer_id) {
  console.time(`[DIAG] /api/projects query — uid:${engineer_id}`);
}
```

And at the point where the final query result is received:
```js
if (DEBUG_MODE && engineer_id) {
  console.timeEnd(`[DIAG] /api/projects query — uid:${engineer_id}`);
  console.log(`[DIAG] Rows returned: ${result.rows.length} | Total count: ${totalCount}`);
  console.log(`[DIAG] JWT role: ${req.user?.role} | region: ${req.user?.region} | division: ${req.user?.division}`);
  console.log(`[DIAG] Active WHERE clauses:`, whereClauses);
}
```

This telemetry:
- Confirms the JWT fields are populated correctly post-Step 1
- Surfaces any `undefined` region/division values that would cause unscoped queries
- Measures actual query time so you can verify index usage reduced latency
- Is automatically silenced in production via the `NODE_ENV` gate

---

# 🛑 CONSTRAINTS & GUARDRAILS

- **DO NOT** change the response shape of `/api/projects` or `/api/dashboard/efd-summary` — frontend components depend on the exact JSON structure.
- **DO NOT** run `ALTER TABLE engineer_form` for any normalization — that is a future task. Only add indexes.
- **DO NOT** use `CONCURRENTLY` inside a transaction block — it will throw `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
- **DO NOT** remove the `engineer_id` query parameter handling — it is still used as the fallback for regular (non-jurisdiction-restricted) engineers.
- **DO NOT** touch `api/middleware/authMiddleware.js` unless Step 1c reveals it does not attach the full decoded payload to `req.user`.
- **DO NOT** batch these changes across multiple files in one shot — complete and verify each Step before moving on.
- **AVOID** generic variable names: use `jurisdictionRole`, `normalizedDivisionParam`, `projectRows` instead of `role`, `div`, `data`.
- **ALL** index creation statements must use `IF NOT EXISTS` — this script will be re-run on every deploy.
