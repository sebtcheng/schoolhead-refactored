# Technical Report: VM Storage Migration & Nginx Routing Restoration
**Date:** April 2, 2026  
**Status:** Completed & Verified  
**Subject:** High-Capacity Storage Migration and Conflict Resolution for `stride.deped.gov.ph`

---

## 1. Executive Summary
This report documents the architectural migration of the InsightEd-Mobile-PWA file storage from the saturated root partition (`/`) to a 300GB high-capacity volume (`/mnt`). It also details the subsequent resolution of a complex Nginx routing conflict that initially prevented image retrieval post-migration.

---

## 2. Phase 1: Storage Migration
### The Problem
The production VM (`20.24.58.49`) root partition reached **96% capacity**, threatening system stability and blocking new file uploads.

### The Solution
1.  **Provisioning:** Created a dedicated `/mnt/uploads/` directory on the high-capacity volume.
2.  **Permissions:** Established standard `www-data:www-data` (775/664) permission sets for the new storage hub.
3.  **Data Sync:** Performed a surgical `rsync` move of ~1.3GB of existing photos and documents from `/var/www/html/` to `/mnt/uploads/`.
4.  **Path Refactoring:** Updated the Node.js API to use the `UPLOAD_DIR` environment variable, ensuring environment parity between local development and production.

---

## 3. Phase 2: Post-Migration Troubleshooting
Immediately following the migration, images on the Staging environment appeared as broken ("Alt-Text" boxes).

### 🔍 Diagnostic: The "Ghost" in the Machine
Initial manual checks of the Nginx configuration suggested the paths were correct, yet `curl` tests returned a mysterious `200 OK` but with `Content-Type: text/html` and a 554-byte payload (the default Nginx landing page).

#### **The Nuclear Diagnostic (Strace)**
To bypass configuration ambiguity, we attached `strace` to the Nginx worker processes at the Linux Kernel level.
*   **Command:** `sudo strace -p [PID] -e trace=openat,newfstatat`
*   **Discovery:** The trace revealed Nginx was looking for images in `/var/www/html/opdash/uploads/` instead of `/mnt/uploads/`.

#### **Root Cause Analysis**
1.  **Wildcard Conflict:** The global `nginx.conf` was set to `include /etc/nginx/sites-available/*;`. This caused Nginx to load every file in that directory, leading to "Server Name Collisions."
2.  **Search Order:** An old configuration named `opdash.conf` (located in `conf.d`) was claiming the same domain and taking alphabetical precedence over the new settings.
3.  **Regex Fall-through:** Nginx was matching a generic image-caching block and defaulting to the wrong root path before reaching our specific `/uploads/` alias.

---

## 4. Phase 3: The "Nuclear" Resolution
We implemented a multi-layered hardening strategy to restore service:

### 1. Prefixed Routing Authority (`^~`)
We upgraded the `/uploads/` location block to use the **Preferential Prefix** modifier:
```nginx
location ^~ /uploads/ {
    alias /mnt/uploads/;
    include /etc/nginx/mime.types;
    ...
}
```
> [!TIP]
> The `^~` modifier ensures that once Nginx matches this path, it **stops** searching for any other regex-based blocks, preventing the common "Image-Cache Hijack" bug.

### 2. Global Decoupling
We edited `/etc/nginx/nginx.conf` to remove the dangerous `sites-available/*` wildcard. Nginx is now restricted to only loading files explicitly linked in `sites-enabled/`.

### 3. Catch-all Authority (`default_server`)
We designated the new `stride.conf` as the `default_server` for Port 80, ensuring it handles all unmapped traffic and correctly directs it to the `/mnt` storage.

---

## 5. Final Verification
A definitive connectivity test was performed against a known migrated asset:
*   **Target:** `photo_1775089817548_lvblfpjes.jpg`
*   **Result:** `HTTP/1.1 200 OK`
*   **Content-Type:** `image/jpeg`
*   **Content-Length:** `185,295 bytes`

**All systems are operational. Images are served from high-capacity storage.**

---

> [!IMPORTANT]
> **Historical Note for Future Maintenance**
> Legacy configurations (`default`, `insighted-staging`, `opdash.conf`) have been moved to `/tmp/nginx_legacy_backup/`. Do not restore these without first checking for domain collisions with `stride.conf`.
