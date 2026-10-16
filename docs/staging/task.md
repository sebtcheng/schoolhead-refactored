# Staging Server — Task Ledger

## Phase 0 — Decisions
- [x] Q1: `insighted-staging` → dedicated schema `siif_staging_v2`
- [x] Q3: Replace old staging script + misnamed PM2 config
- [x] Q4: Staging public (unlisted URL)
- [x] Q5: Users DB → prod (real logins; don't edit profiles on staging)
- [x] Q6: Copy data as-is (identical to prod)
- [ ] Q2: Confirm the real production deploy script (for later alignment)

## Phase 1 — Make staging safe to boot
- [x] `SKIP_BOOT_MIGRATIONS` flag in `apps/school-head/api/index.js`
- [x] `DISABLE_CHAT_CLEANUP` flag in `apps/school-head/api/index.js`
- [x] `SIIF_DB_NAME` override in `packages/shared-db/src/db.js`
- [x] `scripts/staging/sync_staging_db.cjs` (prod read-only → `insighted-staging.siif_staging_v2` + `users_staging_v2`)
- [x] Users copy: 9 tables, 173,730 rows → `users_staging_v2`; `.env.staging` USERS_DATABASE_URL points to it
- [x] Sync ran: 29 tables, 10 views, 1,224,292 rows; counts, columns, sequences, 21 indexes match prod

## Phase 2 — Config
- [x] `.env.staging` generated (git-ignored)
- [x] `ecosystem.schoolhead-staging.config.cjs` rewritten (port 5020, staging name, fork ×1)
- [x] `.env.staging` added to `.gitignore`

## Phase 3 — Deploy script
- [x] `deploy_schoolhead_staging.py` rewritten (preflight → build → package → upload → activate → verify)
- [x] `--check`, `--rollback`, `--logs` modes
- [x] `docs/staging/README.md`
- [x] `--check` passes (SSH ok, port 5020 free, 532 GB free)

## Phase 4 — First deploy & verify
- [ ] Run `py deploy_schoolhead_staging.py` (needs to be run by you, blocked for the agent)
- [ ] Loopback + public health checks pass
- [ ] Production PM2 restart count unchanged
- [ ] SIIF flows tested on staging URL
- [ ] Commit the changes on `feature/siif-optional-forms`
