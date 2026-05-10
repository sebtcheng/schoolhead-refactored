---
description: Trigger this workflow to audit any deployment script (e.g., .py or .sh) to ensure it follows the InsightEd SchoolHead safety protocols (isolated folders, safe Nginx config, no DB locks, and specific PM2 restarts).
---

# Deployment Safety Audit Workflow

This workflow provides a systematic framework for verifying that deployment scripts are safe to run in the InsightEd ecosystem, specifically targeting the SchoolHead portal and associated Azure/VM infrastructure.

## Phase 1: Environment & File Audit
Identify the target script and the intended remote environment.

1. **Locate Target Script**
   - Identify the primary deployment script (e.g., `deploy_schoolhead_pro_IMPROVED.py`).
   - Check for any associated configuration files (e.g., `ecosystem.config.cjs`, `.env`).

2. **Verify Remote Root**
   - Confirm the `REMOTE_ROOT` or target directory.
   - **Protocol 1**: Ensure it is restricted to a sub-folder like `/var/www/html/.../insighted-schoolhead` and does not deploy to the web root or system-critical paths.

## Phase 2: Nginx & Forensic Safety
Ensure the script doesn't accidentally overwrite global configuration or trigger destructive "healing" mechanisms.

3. **Audit Nginx Configuration**
   - **Protocol 2**: Verify the script does NOT include an authoritative `stride.conf` or other `.conf` files in its payload.
   - Check if the script runs `nginx -s reload` or modifies `/etc/nginx/`. It should be passive regarding Nginx.

## Phase 2b: Route & Port Alignment
Ensure the script aligns with the specific routing and ports defined in the global Nginx configuration.

4. **Verify Path & Port Consistency**
   - **Protocol 6**: Audit the script against the **Master Routing Table** below.
   - Ensure the `REMOTE_ROOT` or `alias` targets match the Nginx `location` blocks.
   - Ensure the PM2 or backend startup ports match the `proxy_pass` or `upstream` definitions.

### Master Routing Table (Reference)

| Service | Nginx Location | VM Alias Path | Backend Port |
| :--- | :--- | :--- | :--- |
| **SchoolHead** | `/insighted-schoolhead/` | `/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead/dist/` | `5010` |
| **Staging** | `/insighted-staging/` | `/var/www/html/InsightEd-Staging/dist/` | `5001` |
| **Production** | `/insighted/` | `/var/www/html/InsightEd-Mobile-PWA/dist/` | `5000` |
| **DepEd Mgmnt** | `/insighted-deped-mgmnt/` | `/var/www/html/InsightEd-Mobile-PWA/deped-mgmnt/dist/` | `5005` |
| **Nexus** | `/insighted-nexus/` | `/var/www/html/InsightEd-Mobile-PWA/nexus/dist/` | `5000` |
| **Third Level** | `/insighted-third-level-officials/` | `/var/www/html/InsightEd-Mobile-PWA/third-level-officials/dist/` | `5008` |
| **Infra** | `/insighted-infra/` | `/var/www/html/InsightEd-Mobile-PWA/insighted-infra/dist/` | `5006` |
| **SIIF** | `/insighted-siif/` | `/var/www/html/other-services/siif-service/ui/dist/` | `5015` |
| **ESF7** | `/insighted/Insighted-esf7/` | `/var/www/html/Insighted-esf7/dist/` | `5007` |
| **OpDash** | `/opdash/` | `/var/www/html/opdash/` | `3001` |
| **STRIDE** | `/` | (Root) | `3002` |

## Phase 3: Forensic Safety
Ensure the script doesn't trigger destructive "healing" mechanisms.

5. **Audit Forensic/Patch Files**
   - **Protocol 3**: Scan for "forensic heal" or "emergency patch" files (e.g., `heal.sh`, `the_final_patch.py`) in the deployment archive.
   - These files should be excluded to prevent global configuration drift.

## Phase 4: Database & Lock Prevention
Prevent the "Master Payload Error" caused by intensive schema migrations during high-traffic deployments.

6. **Scan for DB Initialization**
   - **Protocol 4**: Verify the script does NOT manually execute `node api/db_init.js` or SQL initialization scripts.
   - Check if the backend startup logic in `api/index.js` handles migrations safely (e.g., `Instance 0` only, non-fatal try/catch).

## Phase 5: PM2 & Process Isolation
Ensure zero-downtime for unrelated services on the same VM.

7. **Audit PM2 Commands**
   - **Protocol 5**: Verify the script uses targeted restarts (e.g., `pm2 delete <app-name>` or `pm2 start <config>`).
   - **CRITICAL**: Ensure it does NOT use `pm2 restart all` or `pm2 reload all`.

## Phase 6: Report Generation
Summarize the findings for the user before any execution is permitted.

8. **Safety Status Table**
   Generate a report with the following structure:

| Protocol Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **1. Isolated Folder** | [✅/❌] | Description of target path safety. |
| **2. Safe Nginx** | [✅/❌] | Check for authoritative .conf files. |
| **3. Forensic Clean** | [✅/❌] | Check for destructive patch files. |
| **4. No DB Locks** | [✅/❌] | Check for boot-time migration triggers. |
| **5. PM2 Isolation** | [✅/❌] | Check for global restart commands. |
| **6. Route Alignment** | [✅/❌] | Alignment with Master Routing Table. |

9. **Verdict & Recommendation**
   - Provide a clear **SAFE** or **UNSAFE** verdict.
   - Highlight any specific risks or improvements (e.g., switching to 127.0.0.1 for DB proxy).
