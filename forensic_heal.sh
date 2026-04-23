#!/bin/bash
# =============================================================================
# forensic_heal.sh — InsightEd Staging Server Forensic Healing Script
# Target: 20.24.58.49 | User: Administrator1 | PM2: insighted-staging (ID 31)
# Run directly on the staging server as Administrator1.
# =============================================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }

STAGING_DIR="${STAGING_DIR:-/var/www/html/InsightEd-Staging}"
TEMP_DIR="${TEMP_DIR:-/tmp/insighted-pdf-tmp}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-enabled/stride.conf}"
PM2_NAME="${PM2_NAME:-insighted-staging}"

# --- LOG MANAGEMENT PATHS ---
NGINX_ACCESS_LOG="/var/log/nginx/access.log"
NGINX_ERROR_LOG="/var/log/nginx/error.log"
PM2_LOG_DIR="$HOME/.pm2/logs"

# --- SMART PATH DISCOVERY ---
find_tool() {
    local tool=$1
    if command -v "$tool" &>/dev/null; then
        command -v "$tool"
    else
        # Check common non-standard paths
        local paths=("/usr/local/bin/$tool" "/opt/bin/$tool" "/usr/bin/$tool" "/bin/$tool" "$HOME/.npm-global/bin/$tool" "$HOME/bin/$tool")
        for p in "${paths[@]}"; do
            if [ -x "$p" ]; then
                echo "$p"
                return 0
            fi
        done
        return 1
    fi
}

SUDO_CMD="sudo"
if ! command -v sudo &>/dev/null; then
    warn "sudo not found. Proceeding without it..."
    SUDO_CMD=""
elif sudo -n true 2>/dev/null; then
    SUDO_CMD="sudo"
else
    # Check for the specific Windows error if possible, otherwise just warn
    SUDO_VERSION_OUT=$(sudo --version 2>&1 || true)
    if echo "$SUDO_VERSION_OUT" | grep -q "Settings app"; then
        warn "Sudo for Windows is disabled. Proceeding without sudo (this may fail permissions)..."
        SUDO_CMD=""
    fi
fi

# Helper to run with sudo if available
run_sudo() {
    if [ -n "$SUDO_CMD" ]; then
        $SUDO_CMD "$@"
    else
        "$@"
    fi
}

echo ""
echo "========================================================"
echo "  InsightEd Staging — Forensic Healing Script"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================================"
echo ""

# =============================================================================
# PHASE 1: Process Hygiene
# Kill any rogue root-owned Node.js processes in the staging dir,
# then PM2 will be restarted at the end after all fixes are applied.
# =============================================================================
echo -e "${CYAN}[Phase 1] Process Hygiene${NC}"

ROOT_NODE_PIDS=$(ps aux | grep -E "node.*InsightEd-Staging" | grep "^root" | awk '{print $2}' || true)
if [ -n "$ROOT_NODE_PIDS" ]; then
    warn "Found root-owned Node.js processes: $ROOT_NODE_PIDS — killing them."
    echo "$ROOT_NODE_PIDS" | xargs $SUDO_CMD kill -9 2>/dev/null && ok "Root Node processes killed." || fail "Could not kill some root processes."
else
    ok "No rogue root-owned Node.js processes found."
fi

# =============================================================================
# PHASE 2: PDF Pipeline Temp Directory Setup
# All PDFs and images are stored in Postgres binary storage (/api/asset/:id).
# /mnt/uploads is no longer used. Only a writable temp dir is needed for the
# compress_pdf.py pipeline (comp_in_*, comp_out_*, hydra_* scratch files).
# =============================================================================
echo ""
echo -e "${CYAN}[Phase 2] PDF Pipeline Temp Directory — ${TEMP_DIR}${NC}"

run_sudo mkdir -p "$TEMP_DIR"
run_sudo chown Administrator1:www-data "$TEMP_DIR" 2>/dev/null || warn "Failed to chown $TEMP_DIR"
run_sudo chmod 775 "$TEMP_DIR"
ok "Temp dir ready: $TEMP_DIR"

# Inject UPLOAD_DIR into PM2 env so the Node process writes temp files here
# instead of falling back to ./uploads relative to the app directory.
ECOSYSTEM_FILE="${STAGING_DIR}/ecosystem.config.cjs"
if [ -f "$ECOSYSTEM_FILE" ]; then
    if grep -q "UPLOAD_DIR" "$ECOSYSTEM_FILE"; then
        ok "UPLOAD_DIR already set in ecosystem.config.cjs"
    else
        warn "UPLOAD_DIR not set in ecosystem.config.cjs — adding it."
        run_sudo sed -i "s|env: {|env: {\n        UPLOAD_DIR: '${TEMP_DIR}',|" "$ECOSYSTEM_FILE"
        ok "UPLOAD_DIR injected into ecosystem.config.cjs"
    fi
else
    info "No ecosystem.config.cjs found — set UPLOAD_DIR manually in PM2 env or .env:  UPLOAD_DIR=${TEMP_DIR}"
fi

# Sweep and block any lingering /mnt/uploads references in active nginx config
if grep -q "/mnt/uploads" "$NGINX_CONF" 2>/dev/null; then
    warn "/mnt/uploads found in $NGINX_CONF — removing static alias."
    run_sudo sed -i '/\/mnt\/uploads/d' "$NGINX_CONF"
    ok "Removed /mnt/uploads references from nginx config."
else
    ok "Nginx config is clean — no /mnt/uploads references."
fi

# =============================================================================
# PHASE 2.5: Log Management & Disk Reclamation
# Truncate large Nginx and PM2 logs to prevent disk exhaustion.
# =============================================================================
echo ""
echo -e "${CYAN}[Phase 2.5] Log Management & Disk Reclamation${NC}"

truncate_log() {
    local log=$1
    if [ -f "$log" ]; then
        local size=$(du -h "$log" | awk '{print $1}')
        info "Truncating log: $log (Current size: $size)"
        run_sudo truncate -s 0 "$log" || warn "Failed to truncate $log"
    fi
}

# Truncate Nginx Logs
truncate_log "$NGINX_ACCESS_LOG"
truncate_log "$NGINX_ERROR_LOG"
truncate_log "${NGINX_ACCESS_LOG}.1" 2>/dev/null || true

# Truncate PM2 Logs
if [ -d "$PM2_LOG_DIR" ]; then
    find "$PM2_LOG_DIR" -name "*.log" -type f -size +10M -exec truncate -s 0 {} +
    ok "Large PM2 logs (>10MB) truncated."
fi

# Clear old deployment artifacts
find "$STAGING_DIR" -name "*-deploy.tmp.tar.gz" -type f -delete
ok "Cleanup of temporary deployment archives complete."

# [Senior-Dev Harden] Periodic Pruning of Hydra Scratch & Buffers
if [ -d "$TEMP_DIR" ]; then
    info "Pruning old Hydra shards (>120m) in $TEMP_DIR..."
    find "$TEMP_DIR" -type f -mmin +120 -delete 2>/dev/null
    ok "Hydra scratch space pruned."
fi

info "Pruning orphaned PDF buffers in /tmp (>120m)..."
find /tmp -maxdepth 1 -name "bin_*" -mmin +120 -delete 2>/dev/null
ok "Orphaned buffers in /tmp pruned."

# [ESF7] Draft Directory Cleanup (Disabled - Harvester handles per-file cleanup)
# if [ -d "/mnt/esf7_draft" ]; then
#     info "Clearing ESF7 draft folder: /mnt/esf7_draft..."
#     run_sudo rm -rf /mnt/esf7_draft/*
#     ok "Draft folder cleared."
# fi


# [Senior-Dev Harden] Repository Hygiene (Remove .git from staging)
if [ -d "${STAGING_DIR}/.git" ]; then
    warn ".git folder detected in staging — removing to reclaim space."
    rm -rf "${STAGING_DIR}/.git"
    ok ".git removed from $STAGING_DIR"
fi
# =============================================================================
echo ""
echo -e "${CYAN}[Phase 3] Python & PyMuPDF Dependency Check${NC}"

PYTHON_BIN=""
for py in python3 python; do
    if command -v "$py" &>/dev/null; then
        PYTHON_BIN="$py"
        PY_VERSION=$("$py" --version 2>&1)
        ok "Found: $py ($PY_VERSION)"
        break
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    fail "No Python interpreter found on PATH. Install Python 3 before proceeding."
else
    if "$PYTHON_BIN" -c "import fitz; print('PyMuPDF version:', fitz.__version__)" 2>/dev/null; then
        ok "PyMuPDF (fitz) is importable."
    else
        warn "PyMuPDF not found for $PYTHON_BIN. Installing..."
        if "$PYTHON_BIN" -m pip install --break-system-packages pymupdf 2>&1; then
            ok "PyMuPDF installed successfully."
        else
            warn "System pip failed. Trying pip3 directly..."
            pip3 install --break-system-packages pymupdf 2>&1 && ok "PyMuPDF installed via pip3." || fail "PyMuPDF installation failed. Manual intervention required."
        fi
    fi
fi

# Verify compress_pdf.py is accessible and executable
COMPRESS_SCRIPT="${STAGING_DIR}/compress_pdf.py"
if [ -f "$COMPRESS_SCRIPT" ]; then
    ok "compress_pdf.py found at $COMPRESS_SCRIPT"
else
    fail "compress_pdf.py NOT found at $COMPRESS_SCRIPT"
    info "Fix: Run 'bash deploy-staging.sh' or 'node deploy-staging.cjs' to upload missing files."
fi

# =============================================================================
# PHASE 4: Nginx Config Audit & Deploy
# Validates that the live nginx config:
#   a) Has 300s proxy timeouts
#   b) Blocks /uploads/ (all assets served via /api/asset/:id)
#   c) Has X-Real-IP / X-Forwarded-For headers on API proxy blocks
# If any check fails, deploys the authoritative tmp_stride.conf from the
# staging repo and reloads nginx.
# =============================================================================
echo ""
echo -e "${CYAN}[Phase 4] Nginx Config Audit — ${NGINX_CONF}${NC}"

AUTHORITATIVE_CONF="${STAGING_DIR}/tmp_stride.conf"
NEEDS_DEPLOY=false

if [ ! -f "$NGINX_CONF" ]; then
    warn "Nginx config not found at $NGINX_CONF."
    NEEDS_DEPLOY=true
else
    grep -q "proxy_read_timeout 600s"  "$NGINX_CONF" && ok "proxy_read_timeout 600s ✓" || { warn "proxy_read_timeout 600s missing."; NEEDS_DEPLOY=true; }
    grep -q "proxy_connect_timeout 600s" "$NGINX_CONF" && ok "proxy_connect_timeout 600s ✓" || { warn "proxy_connect_timeout 600s missing."; NEEDS_DEPLOY=true; }
    grep -q 'location \^~ /uploads/' "$NGINX_CONF" && ok "/uploads/ block (410 deny) ✓" || { warn "/uploads/ block missing — legacy disk paths would leak."; NEEDS_DEPLOY=true; }
    grep -q "/mnt/uploads" "$NGINX_CONF" && { fail "/mnt/uploads still referenced in nginx config."; NEEDS_DEPLOY=true; } || ok "No /mnt/uploads references ✓"
    
    # Version-based sync check
    LOCAL_VER=$(grep "VERSION:" "$AUTHORITATIVE_CONF" | head -1 || echo "none")
    REMOTE_VER=$(grep "VERSION:" "$NGINX_CONF" | head -1 || echo "none")
    if [ "$LOCAL_VER" != "$REMOTE_VER" ]; then
        warn "Nginx config version mismatch ($REMOTE_VER -> $LOCAL_VER). Forcing update."
        NEEDS_DEPLOY=true
    fi
fi

if [ "$NEEDS_DEPLOY" = true ]; then
    if [ ! -f "$AUTHORITATIVE_CONF" ]; then
        fail "Authoritative config not found at $AUTHORITATIVE_CONF."
        info "Fix: Ensure 'tmp_stride.conf' is in the root directory before deploying."
    else
        # Clean up legacy backups in sites-enabled to prevent Nginx conflicts
        run_sudo mkdir -p /etc/nginx/config_backups
        run_sudo mv /etc/nginx/sites-enabled/*.bak.* /etc/nginx/config_backups/ 2>/dev/null || true
        
        run_sudo cp "$NGINX_CONF" "/etc/nginx/config_backups/stride.conf.bak.$(date +%s)" 2>/dev/null || true
        ok "Backup of existing config saved to /etc/nginx/config_backups/"
        run_sudo cp "$AUTHORITATIVE_CONF" "$NGINX_CONF"
        ok "Deployed authoritative config from $AUTHORITATIVE_CONF"

        if run_sudo nginx -t 2>&1; then
            ok "nginx -t passed."
            run_sudo systemctl reload nginx && ok "Nginx reloaded." || {
                run_sudo service nginx reload && ok "Nginx reloaded via service." || fail "Nginx reload failed."
            }
        else
            fail "nginx -t FAILED — reverting to backup."
            LATEST_BAK=$(ls -t "${NGINX_CONF}".bak.* 2>/dev/null | head -1)
            [ -n "$LATEST_BAK" ] && run_sudo cp "$LATEST_BAK" "$NGINX_CONF" && warn "Reverted to $LATEST_BAK"
        fi
    fi
else
    ok "Nginx config is fully compliant — no changes needed."
fi

# =============================================================================
# PHASE 6: PM2 Restart using Ecosystem Config (Permanent State)
# =============================================================================
echo ""
echo -e "${CYAN}[Phase 6] PM2 Restart — ${PM2_NAME} (Ecosystem Mode)${NC}"

PM2_BIN=$(find_tool pm2)
ECOSYSTEM_PATH="${STAGING_DIR}/ecosystem.config.cjs"

if [ -n "$PM2_BIN" ]; then
    "$PM2_BIN" flush "$PM2_NAME" 2>/dev/null || true
    
    if [ -f "$ECOSYSTEM_PATH" ]; then
        info "Found ecosystem config at $ECOSYSTEM_PATH"
        # Hard Stop and Start is more reliable for picking up code changes
        "$PM2_BIN" stop "$PM2_NAME" "esf7-scheduler" 2>/dev/null || true
        if "$PM2_BIN" start "$ECOSYSTEM_PATH" --only "$PM2_NAME,esf7-scheduler" --update-env 2>&1; then
            ok "PM2 processes '$PM2_NAME' and 'esf7-scheduler' hard-started with ecosystem config."
        else
            fail "PM2 start failed."
        fi

    else
        warn "Ecosystem config NOT found. Falling back to manual restart..."
        if "$PM2_BIN" restart "$PM2_NAME" --update-env 2>&1; then
            ok "Manual restart successful."
        else
            fail "Manual restart failed. Check logs: $PM2_BIN logs $PM2_NAME"
        fi
    fi
else
    fail "PM2 not found on PATH. Cannot restart process automatically."
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "========================================================"
echo -e "  ${GREEN}Forensic Healing Complete${NC}"
echo "  Run 'pm2 logs $PM2_NAME' to monitor startup."
echo "  Run 'pm2 monit' for live resource usage."
echo "========================================================"
echo ""
