# Task Ledger: Unlock SIIF

- [x] Trace the lock (commit `d4c466f`, `settings.nexus_module_locks`, 4 layers)
- [x] Write the implementation plan
- [x] Decide on the target: **local first**. Local `.env` points to the PROD DB, so we use a dev-only override instead of changing the DB
- [x] `VITE_SIIF_DEV_UNLOCK=true` in `apps/school-head/web/.env.local` (git-ignored). Read in `NexusDashboard.jsx` + `SIIFModule.jsx`, gated by `import.meta.env.DEV`
- [x] Fixed the relative fetch in `SIIFModule.jsx` (risk 4.1) → `api('/settings/nexus_module_locks')`
- [x] Production build passes; the override is not in the bundle
- [ ] Back up the current `nexus_module_locks` value for each DB → value: `________`
- [ ] Run the `jsonb_set(... '{siif}', 'false')` UPDATE on the target DB(s)
- [ ] Browser check: the card opens, Forms/Utilization/Settings stay open after a refresh
- [ ] (if needed) Fix the relative fetch in `SIIFModule.jsx` (risk 4.1)
- [ ] (recommended) Add auth to `POST /api/settings/save` (risk 4.3)
- [ ] Update the SIIF School Head user guide
- [ ] Rollout day: unlock production and run the browser check again
