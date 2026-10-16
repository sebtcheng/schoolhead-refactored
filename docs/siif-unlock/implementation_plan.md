# Implementation Plan: Unlock the SIIF Module (for the User Guide, then the Rollout)

**Branch:** `feature/siif-optional-forms`
**Status:** 📋 Proposed (waiting for approval)
**Date:** 2026-10-15
**Related:** [docs/siif-nexus-lock/implementation_plan.md](../siif-nexus-lock/implementation_plan.md), commit `d4c466f` ("siif maintenance")

---

## 1. How the lock works today

Commit `d4c466f` locked SIIF in **4 layers**. All of them read **one database value**:

```
settings.key = 'nexus_module_locks'
settings.value = '{"school-info": false, "esf7": false, "nspp": true, "siif": true}'
```

| Layer | File | What it does when `siif: true` |
|---|---|---|
| DB row | `settings` table (`insightEd`, `insighted-staging`, `siif_database_v2`) | the switch itself |
| API fallback | `apps/school-head/api/units/settings/index.js` | if the row is missing, it answers "locked" |
| Nexus card | `apps/school-head/web/src/modules/NexusDashboard.jsx` | gray card + "Access Restricted" modal |
| Route guard | `apps/siif/web/src/SIIFModule.jsx` | typing `/siif` in the URL bounces you to `/nodes-dashboard` |

**Conclusion:** unlocking needs **no code change**. Set `"siif": false` in the DB row and all 4 layers open. The code stays as it is, so the lock can be turned back on at any time.

---

## 2. Decision needed: where to unlock

| Option | What happens | Risk |
|---|---|---|
| **A. Staging/local only (recommended for today)** | Unlock `insighted-staging` (and local). Take user-guide screenshots there. Production stays locked until the rollout tomorrow. | None for real users |
| B. Production now | Every school head can open SIIF today, before the rollout | The complaints come back a day early |
| C. `?preview=true` link | No DB change. Open `/siif?preview=true` | Breaks when you click to another SIIF page (see 4.2) |

---

## 3. Steps (Option A)

### Step 1: Back up the current value (read-only)
`SELECT value, updated_at FROM settings WHERE key='nexus_module_locks';` on each target DB. Write the value down in `task.md` so we can restore it.

### Step 2: Flip the switch (one `UPDATE`, nothing else)
```sql
UPDATE settings
SET value = jsonb_set(value::jsonb, '{siif}', 'false')::text,
    updated_at = NOW()
WHERE key = 'nexus_module_locks';
```
- Changes only the `siif` key. The other modules (`nspp`, `esf7`, …) keep their values.
- No DDL, no DELETE, no schema change. Follows the Nuclear Deletion Lock and the Column Lock.
- Other way to do it: Admin Dashboard → "Nodes Module Controls" → SIIF toggle (it calls the same endpoint).

### Step 3: Check it in the browser
1. `/nodes-dashboard`: the SIIF card is in color with no 🔒, and clicking it opens SIIF.
2. Go Forms → Utilization → Settings and refresh each page. You must **not** get bounced back to Nexus.
3. If you **do** get bounced, it is bug 4.1 below. Fix it first.

### Step 4: Update the user guide
Take screenshots on staging.

### Step 5: Rollout tomorrow (production)
Run the same `UPDATE` on `insightEd` (and `siif_database_v2` if production reads it). Then repeat the Step 3 checks on production.

### Rollback (any time)
The same `UPDATE` with `'true'`. It takes effect at once. No deploy needed.

---

## 4. Risks found during the investigation

### 4.1 ⚠️ The route-guard fetch uses a relative path
`SIIFModule.jsx:51` calls `fetch('api/settings/nexus_module_locks')` with no leading `/`, and it does not use the `api()` helper. The app is served under `/insighted-schoolhead/`. From `/insighted-schoolhead/siif/forms`, this path becomes `/insighted-schoolhead/siif/api/settings/...`. If nginx returns `index.html` for it, the JSON parse fails and the code **fails closed**. In that case SIIF **stays locked even after the DB is unlocked**.
**Fix if Step 3 fails:** use `fetch(api('/settings/nexus_module_locks'))`, the same call `NexusDashboard.jsx:63` uses.

### 4.2 `?preview=true` does not persist
The bypass reads the URL param on every render. Moving to `/siif/utilization` drops the param, the effect runs again, and you are redirected. This is why Option C is not reliable for screenshots.

### 4.3 🔴 `POST /api/settings/save` has no auth check
Added in `d4c466f`. Anyone who knows the URL can change `nexus_module_locks` or `maintenance_mode`. Recommended: add the existing auth and admin-role middleware **before the rollout**. This is separate from the unlock and can ship in the same PR.

---

## 5. Files touched
| File | Change |
|---|---|
| `settings` row (DB) | `siif: true → false` |
| `apps/siif/web/src/SIIFModule.jsx` | *only if 4.1 shows up*: use the `api()` helper |
| `apps/school-head/api/units/settings/index.js` | *recommended*: auth on `POST /api/settings/save` |
