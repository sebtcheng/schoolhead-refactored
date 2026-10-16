# SchoolHead Staging — How To

**URL:** https://stride.deped.gov.ph/insighted-schoolhead-staging/
**Server:** `Administrator1@20.24.58.49:/mnt/insighted-schoolhead-staging`
**PM2:** `insighted-schoolhead-staging-backend` (port 5020) · **Prod is untouched** (port 5010)

## Deploy
```powershell
py deploy_schoolhead_staging.py --check     # 1. preflight only, changes nothing
py deploy_schoolhead_staging.py             # 2. build + deploy + health check (auto-rollback on failure)
py deploy_schoolhead_staging.py --logs      # view staging logs
py deploy_schoolhead_staging.py --rollback  # go back to the previous release
```
Needs `.env.staging` in the repo root (git-ignored). It is a copy of `.env` with staging values. The script refuses to run if it points at production SIIF.

## Refresh staging data from production
```powershell
node scripts/staging/sync_staging_db.cjs --dry-run      # show what would be copied
node scripts/staging/sync_staging_db.cjs                # refresh SIIF + users
node scripts/staging/sync_staging_db.cjs --only users   # refresh one (siif | users)
py deploy_schoolhead_staging.py --sync-db               # refresh both, then deploy
```
Prod is read in a read-only snapshot. Only the `*_staging_v2` schemas are rebuilt (build → verify → swap). `public` in `insighted-staging` is never touched.
⚠️ A refresh **resets** staging: passwords or SIIF data changed on staging are replaced with production's.

## Where staging reads/writes

| Data | Staging uses | Note |
|------|--------------|------|
| SIIF | `insighted-staging` → schema `siif_staging_v2` | Safe to test freely |
| Main (School Head units) | `insighted-staging` → `public` | Staging data, may be older than prod |
| Users / logins | `insighted-staging` → schema `users_staging_v2` (copy of `users_database`) | Same accounts as prod. Safe to change passwords and profiles |
| Chat | **prod** `chat_database` | ⚠️ Avoid sending chats on staging |
| File uploads (Azure Blob) | **prod** storage account | ⚠️ Avoid uploading files on staging |
| Local uploads | `/mnt/insighted-schoolhead-staging/uploads` | Shared across releases |

Startup migrations and the chat auto-cleanup are **off** on staging (`SKIP_BOOT_MIGRATIONS`, `DISABLE_CHAT_CLEANUP`).

## Server layout
```
/mnt/insighted-schoolhead-staging/
├── releases/<YYYYMMDD-HHMMSS>/   last 3 kept
├── current -> releases/<latest>  PM2 runs from here
├── dist    -> current/dist       Nginx serves this
├── uploads/  logs/  tmp/
└── .current_release  .previous_release
```
