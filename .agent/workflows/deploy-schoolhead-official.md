---
description: Trigger this workflow to deploy the InsightEd SchoolHead application using the hardened IMPROVED script and Master Tinkerer safety audits.
---

# Deployment: InsightEd SchoolHead (Official)

This workflow combines the automated execution of the IMPROVED deployment script with mandatory safety audit protocols to ensure zero-downtime and infrastructure stability.

## Phase 1: Deployment Safety Audit
Before running the script, verify that the current configuration adheres to the InsightEd safety standards as defined in [.agent/workflows/deploy-safety-audit-SH.md](file:///d:/InsightED/InsightED-SchoolHead/InsightEd-SchoolHead-Official/.agent/workflows/deploy-safety-audit-SH.md).

| Protocol Requirement | Status | Analysis |
| :--- | :--- | :--- |
| **1. Isolated Folder** | [✅] | Targets `/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead/` |
| **2. Safe Nginx** | [✅] | Script does not modify `/etc/nginx/` directly. |
| **3. Forensic Clean** | [✅] | No destructive patch files included in payload. |
| **4. No DB Locks** | [✅] | Uses targeted PM2 reset; no boot-time migration triggers. |
| **5. PM2 Isolation** | [✅] | Targets only `insighted-schoolhead-backend`. |
| **6. Route Alignment** | [✅] | Aligned with Port `5010` and Nginx `/insighted-schoolhead/`. |

> [!IMPORTANT]
> **NIC Bottleneck Bypass**: This workflow utilizes a script that automatically updates the `.env` on the server to use `127.0.0.1:6432` instead of the public IP, significantly reducing latency and preventing Azure NIC saturation.

## Phase 2: Deployment Execution
Execute the production-grade deployment script.

// turbo
1. **Run Deployment Script**
   ```powershell
   py deploy_schoolhead_pro_IMPROVED.py
   ```

## Phase 3: Post-Deployment Verification
Ensure the service is responding correctly on the production network.

// turbo
2. **Verify API Health**
   Check if the API is responding to queries.
   ```powershell
   curl -s https://stride.deped.gov.ph/insighted-schoolhead/api/ping
   ```

3. **Visit Production Site**
   [https://stride.deped.gov.ph/insighted-schoolhead/](https://stride.deped.gov.ph/insighted-schoolhead/)

## Troubleshooting
If the health check fails:
1. **Check PM2 status**: `pm2 status insighted-schoolhead-backend` on the VM.
2. **Review logs**: `pm2 logs insighted-schoolhead-backend --lines 100`.
3. **Verify port 5010**: `sudo netstat -tulpn | grep 5010`.
