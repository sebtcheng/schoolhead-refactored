# Technical Report: Backend Lifecycle Restoration & Service Hardening
**Date:** April 2, 2026  
**Status:** Completed & Verified  
**Subject:** Resolution of 502 Bad Gateway and Implementation of Backend Persistence

---

## 1. Executive Summary
This report documents the systematic recovery of the Stride Production and Staging backend services following a widespread service failure (502 Bad Gateway). It details the diagnostic discovery of environment discrepancies and multi-user process conflicts, as well as the implementation of a "Nuclear Cleanup" strategy and path-locked restoration to ensure ongoing system resilience.

---

## 2. Problem Statement
Immediately following a storage migration and Nginx reconfiguration, both the Production and Staging portals reported a **502 Bad Gateway**. 

### 🔍 Initial Audit Findings
- **PM2 State Loss:** The Process Manager list was empty for the primary user (`Administrator1`).
- **Production (Port 5000):** Service was **OFFLINE**. No listener detected.
- **Staging (Port 5001):** Service was in a **"Zombie" State**—listening on the port but unmanaged by PM2 and unresponsive to web traffic.

---

## 3. Root Cause Analysis (RCA)
A deep "Archaeological Audit" performed via kernel-level process inspection revealed three critical failures:

1.  **Environment Mismatch (Production):** The Production `.env` file at `/var/www/html/InsightEd-Mobile-PWA/` was missing the `PORT=5000` variable. The application was defaulting to Port 3000, causing Nginx (configured for Port 5000) to fail connection.
2.  **Multi-User Collision:** Ghost instances of the applications were running under the `root` user, preventing the `Administrator1` user from correctly binding to the target ports and causing "Silent Conflicts."
3.  **Pathing Error:** Previous restart attempts were initiated from the wrong root directory (`/var/www/html/`), leading to "Module Not Found" errors as the apps expected to be started from their specific subdirectories.

---

## 4. Implementation: The "Nuclear" Restoration
We executed a multi-step recovery protocol to re-establish the application layer:

### Layer 1: Environmental Synchronization
Manually updated the Production environment at `/var/www/html/InsightEd-Mobile-PWA/.env` to include:
```bash
PORT=5000
UPLOAD_DIR=/mnt/uploads
```

### Layer 2: Forensic Cleanup (Process Purge)
Executed a global purge to clear all conflicting Node.js instances:
- **Global Kill:** `sudo pkill -f node` (Clearing root and Administrator1 instances).
- **Port Liberation:** `sudo fuser -k 5000/tcp 5001/tcp 3000/tcp`.

### Layer 3: Path-Locked Restoration
Restarted the services from their definitive source directories to ensure correct dependency resolution:
- **Production Site:** Started from `/var/www/html/InsightEd-Mobile-PWA/`.
- **Staging Site:** Started from `/var/www/html/InsightEd-Staging/`.

### Layer 4: State Locking (Persistence)
Once health checks passed, we executed **`pm2 save`** to bind the current process list to the VM's startup script.

---

## 5. Verification Results
Definitive health checks confirmed full restoration:
*   **Port 5000:** `HTTP/1.1 200 OK` (via Production Nginx Proxy).
*   **Port 5001:** `HTTP/1.1 200 OK` (via Staging Nginx Proxy).
*   **Process Authority:** All apps are now exclusively managed by PM2 under the `Administrator1` user.

---

> [!IMPORTANT]
> **Persistence Protocol for Developers**
> Always run `pm2 save` after starting a new service. Failure to do so will result in "Quiet Failures" (502 errors) on the next VM reboot or Nginx service update.
