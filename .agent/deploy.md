# 📜 Master Deployment Rulebook: Repo-Agnostic Smooth Deployment Protocol

> **Core mandate:** Deployment automation must be safe, repeatable, and repository-agnostic. Agents and developers must inspect the target repository, infer its deployment topology, follow the existing reverse-proxy and process-manager configuration as the source of truth, and deploy through a hardened pipeline that minimizes downtime, socket stalls, cache issues, and cross-application impact.
> 

## 🛑 Section 1: Absolute Safety Boundaries

```
⛔ DEPLOYMENT SAFETY CONSTRAINTS

1. READ-ONLY WEB SERVER POLICY
   - Inspect Nginx/Apache/Caddy configuration only as needed to understand routing.
   - Treat existing reverse-proxy configuration as the source of truth.
   - Do not edit, overwrite, delete, or reload web server configuration unless explicitly instructed.

2. REPOSITORY-LOCAL EXECUTION
   - Build, package, clean, and deploy only within the target repository and its assigned deployment path.
   - Do not alter unrelated apps, ports, PM2 processes, databases, or server directories.

3. ZERO DATABASE DESTRUCTION
   - Do not run migrations, seeders, schema drops, table alterations, destructive scripts, or data rewrites unless explicitly requested.
   - Runtime database variables may be validated, but database state must not be changed by default.

4. FAILURE-CONTAINMENT ORDERING
   - Validate prerequisites, build output, deployment bundle, and SSH connectivity before touching the live deployment directory.
   - A failed upload, SSH timeout, or build error must not leave the live site dark.
   - Cleanup must be scoped and recoverable.

5. MINIMAL NETWORK SURFACE
   - Prefer one compressed deployment bundle and one remote execution phase over many small file transfers and repeated SSH sessions.
   - Use hard timeouts, retries, and SSH keepalive flags to avoid terminal freezes and partial deployments.
```

## 🧭 Section 2: Repo-Agnostic Discovery Rules

Before deploying, the agent must inspect the repository and existing server topology to discover:

1. **Application identity**
    - App name
    - Frontend package, if any
    - Backend package, if any
    - Process-manager name
    - Expected health endpoint or fallback route
2. **Deployment topology**
    - Public domain and public base path
    - Static asset serving path
    - API route prefix
    - Local backend port
    - Reverse-proxy target
    - Server deployment directory
3. **Build system**
    - Package manager: `npm`, `pnpm`, `yarn`, `bun`, or other
    - Build command
    - Output directory, such as `dist`, `build`, `.next`, or server bundle
    - Monorepo workspace structure, if applicable
4. **Runtime system**
    - PM2, systemd, Docker, or other process manager
    - Start/reload command
    - Environment file location
    - Runtime dependencies
    - Node/Python/runtime version expectations
5. **Configuration contract**
    - Required `.env` variables
    - Public frontend base path
    - API base URL
    - CORS/client origin values
    - Port variable used by the backend
    - Any repo-specific deployment script already provided

The agent must not hardcode a project name, port, domain, PM2 process, or directory unless those values are discovered from the repository, deployment config, or user-provided instructions.

## 🔄 Section 3: Standard Deployment Pipeline

```
+-----------------------------------------------------------------------------------+
|                            PHASE 0: INTENT & SCOPE LOCK                           |
|  Confirm target repo/app -> Identify environment -> Lock safety boundaries         |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 1: DISCOVERY & PREFLIGHT                         |
|  Inspect repo, .env, scripts, reverse proxy, PM2/systemd, SSH readiness            |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 2: CONFIG SYNCHRONIZATION                        |
|  Align base paths, API URLs, CORS origins, ports, process names, output paths      |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 3: BUILD & LOCAL VALIDATION                      |
|  Install deps if needed -> Build -> Verify output -> Verify manifest completeness  |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 4: SINGLE-BUNDLE TRANSPORT                       |
|  Package deploy_bundle.tar.gz -> Upload once -> Avoid repeated SCP/SSH churn       |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 5: ATOMIC REMOTE EXECUTION                       |
|  Extract bundle -> Install production deps -> Reload target process only           |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|                            PHASE 6: HEALTH, ASSETS & LOG VERIFICATION             |
|  Loopback check -> Public HTTP check -> Asset check -> Logs -> Rollback if needed  |
+-----------------------------------------------------------------------------------+
```

## ✅ Section 4: Detailed Pipeline Requirements

### Phase 0: Intent & Scope Lock

- Identify the exact app/repository being deployed.
- Identify the target environment: production, staging, demo, or development.
- Confirm whether the request is a deployment, readiness check, rollback, or troubleshooting task.
- Keep all actions scoped to the target app.

### Phase 1: Discovery & Preflight

Perform read-only checks first:

- Confirm required files exist:
    - `.env` or documented environment source
    - package manifest / build manifest
    - deployment script, if present
    - process-manager config, if present
- Validate SSH requirements:
    - host
    - user
    - private key path
    - key file exists locally
    - passwordless SSH works
- Inspect existing reverse proxy:
    - public base path
    - static asset path
    - API proxy path
    - local upstream port
- Inspect current process manager:
    - PM2 process name or systemd service name
    - process status
    - current port ownership
    - restart count and memory usage

Recommended SSH flags:

```bash
-o ControlMaster=no -o ConnectTimeout=60 -o ServerAliveInterval=10 -o ServerAliveCountMax=6
```

### Phase 2: Configuration Synchronization

Synchronize deployment config to discovered topology:

- Frontend public base path must match the reverse-proxy subpath.
- API base URL must match the public API prefix.
- Backend port must match the reverse-proxy upstream.
- CORS/client origins must include the production origin.
- Process-manager name must match the target app only.
- Environment files must be included only where needed for runtime.

For subpath deployments:

```
Frontend base path = public app subpath
API base URL       = public API subpath
Router basename   = frontend base path
Static asset URLs  = emitted under the app subpath
```

Hardcoded root paths such as `/assets/...` are prohibited when the app is served below a subpath.

### Phase 3: Build & Local Validation

- Use the repo’s declared package manager and build command.
- Prefer existing deployment scripts when they are safe and scoped.
- Validate that the build output exists before packaging.
- Confirm generated `index.html` references assets that exist.
- Confirm server files, runtime package files, lockfiles, and required `.env` files are included.
- Do not wipe the remote deployment directory until the local build and bundle are valid.

### Phase 4: Single-Bundle Transport

Prefer one compressed bundle:

```bash
deploy_bundle.tar.gz
```

The bundle should include only required deployment artifacts, such as:

- frontend build output
- backend runtime files
- package manifest and lockfile
- process-manager config
- required runtime `.env` files
- public assets required by the build

Avoid repeated SCP transfers of many small files. This reduces timeout risk, TCP socket churn, and partial upload states.

### Phase 5: Atomic Remote Execution

Use a single hardened remote execution phase when possible:

- Create a temporary release directory.
- Extract the uploaded bundle.
- Verify expected folders and files exist.
- Install production dependencies only if required.
- Preserve or restore file permissions as needed.
- Reload/restart only the target process.
- Clean up the temporary bundle.
- Keep rollback artifacts or previous release available when practical.

For PM2:

```bash
pm2 reload <target-app-name> --update-env
```

If reload is not possible:

```bash
pm2 restart <target-app-name> --update-env
```

Do not run global PM2 resets, broad process kills, or unrelated process deletions.

### Phase 6: Health, Assets & Logs Verification

Validate from inside the VM first:

```bash
curl -s -f http://127.0.0.1:<PORT>/<health-endpoint>
```

If no health endpoint exists:

```bash
curl -s -I http://127.0.0.1:<PORT>/
```

Then validate the public URL:

```bash
curl -s -I <public-app-url>
```

For frontend apps:

- Fetch public HTML with no-cache headers.
- Confirm referenced JS/CSS assets exist and return 200.
- Confirm asset URLs use the correct subpath.
- Confirm route refreshes do not 404.
- Detect service worker files and warn if cache invalidation may persist.

For backend/API apps:

- Confirm PM2/systemd status is healthy.
- Check recent logs.
- Confirm no immediate crash loop.
- Confirm no `ECONNREFUSED`, CORS, missing module, missing env, or port conflict errors.

## 🧰 Section 5: Preferred Deployment Utilities

Agents should prefer existing repository deployment utilities if they satisfy the safety rules above.

| Utility | When to use | Required behavior |
| --- | --- | --- |
| `python deploy.py` | Cross-platform deployments, especially Windows PowerShell | Must validate `.env`, SSH, build output, bundle contents, upload, remote execution, process reload, and HTTP health |
| `bash deploy.sh` | Linux, macOS, WSL, Git Bash | Must use strict error handling, cleanup traps, scoped paths, and health checks |
| Existing CI/CD pipeline | When repository already has a trusted production workflow | Must not bypass required checks, secrets handling, or rollback procedures |
| Manual SSH commands | Emergency or diagnostic use only | Must be scoped, logged, and reversible |

Deployment tools should implement:

- retry with backoff
- SSH keepalive
- hard command timeouts
- single-bundle upload
- single remote execution where practical
- clear failure messages
- post-deploy verification

## 🩺 Section 6: Troubleshooting Playbook

### Issue A: SSH connection timeout

**Symptoms**

- `Connection timed out`
- terminal freezes during SSH/SCP
- deployment stops mid-transfer

**Checks**

```bash
ssh -o ControlMaster=no -o ConnectTimeout=60 -o ServerAliveInterval=10 -o ServerAliveCountMax=6 -i <key> <user>@<host> "echo OK"
```

On the VM:

```bash
uptime
free -h
df -h
swapon --show
sudo journalctl -k --since "24 hours ago" --no-pager | egrep -i "oom|out of memory|killed process"
```

**Likely causes**

- VM memory pressure or OOM
- CPU or disk I/O saturation
- no swap
- unstable local network or VPN
- SSH socket reuse issue
- firewall / NSG / route problem

**Required mitigations**

- Use keepalive and timeout SSH flags.
- Disable SSH connection reuse with `ControlMaster=no`.
- Use one compressed upload instead of many small transfers.
- Add swap if the VM has no swap.
- Add process memory limits for PM2 apps.
- Investigate OOM logs before assuming it is only a network issue.

### Issue B: Permission denied / public key failure

**Symptoms**

- `Permission denied (publickey)`
- private key not found
- deployment script cannot read key

**Checks**

```bash
ls -la <key-path>
ssh -i <key-path> <user>@<host> "echo OK"
```

**Fixes**

- Correct the local key path.
- Ensure private key file permissions are valid.
- Confirm the public key exists in the VM user’s `authorized_keys`.
- Confirm the deployment script reads the intended `.env`.

### Issue C: 502 Bad Gateway / API unavailable

**Symptoms**

- frontend loads but API fails
- `502 Bad Gateway`
- `ECONNREFUSED`
- reverse proxy cannot reach backend

**Checks**

```bash
pm2 status
pm2 logs <target-app-name> --lines 100
lsof -i :<PORT>
curl -s -I http://127.0.0.1:<PORT>/
```

**Fixes**

- Ensure backend listens on the discovered port.
- Ensure reverse proxy points to that port.
- Ensure `.env` contains required runtime variables.
- Ensure dependencies are installed.
- Ensure PM2 process name and working directory are correct.
- Restart/reload only the target process.

### Issue D: Static assets 404 / blank screen

**Symptoms**

- frontend HTML loads but JS/CSS returns 404
- blank white page
- route refresh returns 404
- assets load from `/assets/...` instead of app subpath

**Checks**

```bash
curl -s <public-app-url> | grep -Eo 'src="[^"]+|href="[^"]+'
```

**Fixes**

- Set frontend base path to the public subpath.
- Set router basename to the same base path.
- Confirm generated asset files exist in the deployed output.
- Confirm reverse proxy serves the static directory for the subpath.
- Rebuild after correcting base path variables.

### Issue E: API 500 caused by CORS or environment mismatch

**Symptoms**

- API endpoint returns 500
- login or auth endpoint fails
- logs mention CORS origin not allowed
- production origin missing from allowed client URLs

**Checks**

```bash
pm2 logs <target-app-name> --lines 100
grep -E "CLIENT_URL|CLIENT_URLS|CORS|ORIGIN|PORT|DATABASE_URL" <env-file>
```

**Fixes**

- Include the production origin in allowed client URLs.
- Confirm API base URL and frontend origin match the reverse-proxy topology.
- Reload PM2 with updated environment:

```bash
pm2 reload <target-app-name> --update-env
```

### Issue F: PM2 crash loop or memory pressure

**Symptoms**

- PM2 restarts repeatedly
- VM becomes unresponsive
- OOM killer logs mention `node`, `python3`, or app workers

**Checks**

```bash
pm2 status
pm2 jlist
ps -eo pid,ppid,user,comm,%mem,%cpu,rss,vsz,args --sort=-rss | head -30
sudo journalctl -k --since "24 hours ago" --no-pager | egrep -i "oom|out of memory|killed process"
```

**Fixes**

- Add PM2 memory restart limits.
- Limit heavy worker concurrency.
- Add swap if missing.
- Stream large files instead of loading entire datasets into memory.
- Move heavy jobs to background workers where appropriate.
- Avoid running build workloads on an undersized production VM during peak usage.

## 🚨 Section 7: Emergency Rollback Procedure

If deployment causes critical downtime:

1. Stop further writes or destructive cleanup.
2. Identify the last known good release, commit, or bundle.
3. Restore the previous release directory or check out the stable commit.
4. Re-run the safe deployment utility.
5. Reload only the target process.
6. Verify loopback health.
7. Verify public HTTP status.
8. Check logs for crash loops.
9. Document the root cause before the next deployment.

Generic rollback commands:

```bash
git checkout <last-stable-commit-hash>
python deploy.py
```

or, when using a release-directory strategy:

```bash
ln -sfn <previous-release-dir> current
pm2 reload <target-app-name> --update-env
```

## 📋 Section 8: Pre-Flight Checklist

- [ ]  Target repository/app confirmed.
- [ ]  Target environment confirmed.
- [ ]  Deployment scope limited to the target app.
- [ ]  Existing reverse-proxy config inspected read-only.
- [ ]  Public app URL and base path identified.
- [ ]  Public API path identified.
- [ ]  Local upstream port identified.
- [ ]  Static asset path identified.
- [ ]  Process-manager name identified.
- [ ]  `.env` or runtime config source verified.
- [ ]  SSH host, user, and key path verified.
- [ ]  Passwordless SSH tested with keepalive flags.
- [ ]  Build command and output directory identified.
- [ ]  Frontend base path and API base path synchronized.
- [ ]  CORS/client origins synchronized.
- [ ]  Bundle manifest verified.
- [ ]  Build output verified before upload.
- [ ]  No database migration/seed/destructive command scheduled.
- [ ]  Rollback path known.

## 📋 Section 9: Post-Flight Checklist

- [ ]  Bundle uploaded successfully.
- [ ]  Remote extraction succeeded.
- [ ]  Required files exist on server.
- [ ]  Production dependencies installed where required.
- [ ]  Target PM2/systemd process reloaded only.
- [ ]  Loopback health check passed.
- [ ]  Public app URL returns expected status.
- [ ]  Public API route returns expected status.
- [ ]  Frontend assets return 200.
- [ ]  Subpath routing works.
- [ ]  Logs show no crash loop.
- [ ]  No OOM or resource spike occurred during deployment.
- [ ]  Temporary bundle cleaned up.
- [ ]  Rollback artifact retained where practical.