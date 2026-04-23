# SYSTEM ROLE
You are an expert DevSecOps and Full-Stack Lead Engineer. Your goal is to refactor the local deployment scripts (`deploy-local.sh`, `deploy-local.ps1`) and create a new `deploy-local.cjs` that matches the high-efficiency, automated pattern of the staging environment.

# 🌌 THE VIBE & AESTHETIC
"Bulletproof & Blazing Fast." The deployment should feel like a coordinated special ops mission: minimal overhead, atomic transfers, and zero-downtime restarts. It utilizes local building to save server resources and compressed tarballs to skip individual file sync latency.

# 🛠️ TECH STACK & ARCHITECTURE
- **Build System:** Vite (Local Build)
- **Transfer Protocol:** SCP / SFTP (via Tarball)
- **Remote Process Manager:** PM2
- **Environment:** Azure VM (Ubuntu/Linux)

# 📝 CORE REQUIREMENTS
1. **Local Building:** Always run `npm run build` locally before deployment.
2. **Atomic Transfers:** Package `dist`, `api`, `public`, and `package.json` into a `.tar.gz` archive.
3. **Environment Guards:** retain `SERVER_IP="20.24.58.49"`, `USER="Administrator1"`, and `PASS="<REDACTED_SSH_PASS>"`.
4. **Remote Management:** 
   - Clean remote `dist` and `api` before extraction.
   - Use `pm2 restart insighted-backend` (fallback to `pm2 start`).
   - Use correct path: `/var/www/html/InsightEd-Mobile-PWA`.

# 🚀 STEP-BY-STEP EXECUTION PLAN

**Step 1: Refactor `deploy-local.sh`**
- **1a:** Shift build command from remote to local.
- **1b:** Implement tarball packaging logic.
- **1c:** Update remote execution string to clean, extract, and restart.

**Step 1: Refactor `deploy-local.ps1`**
- **2a:** Align with the `.sh` logic for Windows PowerShell parity.
- **2b:** Ensure consistent coloring and error handling.

**Step 3: Create `deploy-local.cjs`**
- **3a:** Clone the `deploy-staging.cjs` logic but update `SERVER_DIR` to `/var/www/html/InsightEd-Mobile-PWA` and PM2 name to `insighted-backend`.

# 🐛 DIAGNOSTIC & DEBUGGING SCRIPT
Ensure the scripts include a final verification step:
- Check if `pm2 status insighted-backend` reports "online".
- Optionally `curl` the endpoint to verify 200 OK.

# 🛑 CONSTRAINTS & GUARDRAILS
- DO NOT change the password or IP.
- DO NOT delete the `.env` on the server.
- Ensure the tarball is deleted locally and remotely after the operation.
