# Task Ledger: SIIF Locked in Production

- [x] Trace every lock layer (Nexus card, route guard, settings API, boot seed)
- [x] Explain why local is unlocked (`VITE_SIIF_DEV_UNLOCK` in `.env.local`, dev only)
- [x] Confirm the settings API reads `cloud_database` (`CLOUD_DATABASE_URL`), not `insightEd`
- [x] Confirm prod ships the root `.env` (deploy `INCLUDE`); PM2 overrides only `NODE_ENV`, `PORT`
- [ ] Phase 1: run Q1 on `cloud_database` and Q2 `curl` on the prod server
- [ ] Phase 2: set `"siif": false` (a boolean) in `cloud_database.settings`, then hard-refresh
- [ ] Phase 3 (optional): strict `!== false` parse, log fallback errors, log the active DB at boot
- [ ] Phase 4 (decision): remove the hard-coded DB credentials from `db.js` and rotate the password; fix `INSIGHTED_STAGING_URL==`
