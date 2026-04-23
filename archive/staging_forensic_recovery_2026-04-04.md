# 🩺 InsightEd Staging — Forensic Recovery Report (2026-04-04)

## 📋 Executive Summary
This report documents the forensic audit and stabilization of the InsightEd Staging environment. Major recovery milestones include the restoration of the PDF compression pipeline and the unification of deployment-healing workflows.

## 🔍 Audit & Root Cause Analysis

### 1. The "Ghost File" Bug
**Identified:** `compress_pdf.py` was missing on the server.
**Cause:** The build pipeline (Vite) excluded path-external Python scripts, and the deployment script was not explicitly configured to include them.
**Fix:** Explicit inclusion of `compress_pdf.py` in the production tarball.

### 2. Deep Timeout & Buffering Hardening
**Identified:** PDF uploads over 20MB were failing with 504 Gateway Timeouts even after initial fixes.
**Cause:** 300s proxy timeouts were insufficient for the PDF compression pipeline; Nginx request buffering was adding latency for large bodies; and Node.js default server timeouts were terminating connections prematurely.
**Fix:** 
- Set `proxy_request_buffering off;` and increased Nginx timeouts to `600s`.
- Aligned Node.js `server.timeout` / `keepAliveTimeout` to `600s`.
- Automated enforcement via `tmp_stride.conf` and `forensic_heal.sh`.

### 3. Permission & Toolchain Resilience
**Identified:** Sudo commands failed with "Sudo for Windows" error; `pm2`/`psql` not found.
**Cause:** Restricted environment permissions and non-standard tool installation directories.
**Fix:** Implemented `run_sudo` wrapper and `find_tool` path-scanning logic in `forensic_heal.sh`.

## 🛠️ Infrastructure Changes
*   **Unified Command:** `npm run heal:staging` now orchestrates the entire build -> deploy -> heal lifecycle.
*   **Persistent Scratch Space:** `/tmp/insighted-pdf-tmp` established as a dedicated, writable scratch directory for the Python processing engine.

## 📈 Status: STABILIZED
Staging is now capable of handling large-scale PDF uploads and metadata persistence without intervention.

---
*Verified by Antigravity (Avid Documenter Module)*
