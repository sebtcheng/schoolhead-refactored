# Implementation Plan: Restoring the SIIF Module Lock in Nexus & SchoolHead

**System Roles:** Master Tinkerer (Holistic Diagnostics & Flawless Execution) & Sentinel Protocol  
**Domain:** InsightED SchoolHead (`apps/school-head`), SIIF Module (`apps/siif`), and Central Database  
**Target Environments:** Production (`insightEd`), Staging (`insighted-staging`), and SIIF DB (`siif_database_v2`)  
**Status:** 📋 Proposed — Awaiting User Approval  
**Date:** October 15, 2026  

---

## 🎯 1. Objective & Context

### Context
During recent development and testing, the **SIIF (School Innovation and Intervention Fund) Hub** was unlocked in production to allow the engineering team to test code updates (utilization tracking, quarter-based forms, activity checklists).

### Goal
Restore the security lock on the SIIF module across the entire platform. When a school head or regular user views the Nexus Dashboard (`/nodes-dashboard`) and clicks the SIIF card:
1. The card must be visibly locked (**"Access Restricted 🔒"**, grayscale, muted hover).
2. Clicking the card must not navigate into the module, but instead display a sleek, branded **InsightED Maintenance & Access Restriction Modal** explaining that the module is locked for review/maintenance.
3. Direct navigation to `/siif/*` via the browser URL bar must be guarded and intercepted so unauthorized users cannot bypass the UI.
4. Admins with authorized credentials retain the ability to toggle or bypass when conducting official maintenance.

---

## 🔍 2. Architectural Root Cause & Forensic Findings

Our investigation into the codebase and database revealed:

1. **Database Row in `settings`:**
   The `nexus_module_locks` row in `insightEd`, `insighted-staging`, and `siif_database_v2` currently stores:
   ```json
   {"school-info": false, "esf7": false, "nspp": true}
   ```
   Notice `"siif"` is completely absent from the JSON object.

2. **Frontend Fallback Logic in `NexusDashboard.jsx`:**
   ```javascript
   isLocked: dynamicLocks.hasOwnProperty('siif') ? dynamicLocks['siif'] : false
   ```
   Because `"siif"` was missing from `dynamicLocks`, `hasOwnProperty('siif')` evaluated to `false`, causing the module to default to **UNLOCKED** (fail-open vulnerability).

3. **Click Handling in `NexusDashboard.jsx`:**
   Currently, clicking a locked card simply evaluates `if (!mod.isLocked) handleCardClick(...)`. While this prevents navigation, it provides zero user feedback—leaving users confused when nothing happens.

4. **Missing Backend Endpoint for `AdminDashboard`:**
   In `AdminDashboard.jsx`, the admin toggle sends a request to `POST /api/settings/save`. However, `apps/school-head/api/units/settings/index.js` currently only implements `GET /api/settings/:key`. Adding `POST /api/settings/save` will ensure dynamic lock toggles persist directly from the admin UI.

---

## 🛠️ 3. Multi-Layer Locking Strategy

### Layer 1: Database Setting Update (Zero-Trust Persistence)
Update the `nexus_module_locks` record in the `settings` table across target databases:
```sql
UPDATE settings 
SET value = '{"school-info": false, "esf7": false, "nspp": true, "siif": true}',
    updated_at = NOW()
WHERE key = 'nexus_module_locks';
```
*Guardrail Compliance:* This is an idempotent `UPDATE` on existing data in the `settings` table. No DDL operations, no column modifications, and no violation of the Immutable Nuclear Deletion Lock.

### Layer 2: Backend API Hardening (`apps/school-head/api/units/settings/index.js`)
1. **Fail-Closed Default:**
   Update the fallback in `GET /api/settings/:key` so that if `nexus_module_locks` is ever missing, it defaults to locked for SIIF:
   ```javascript
   if (key === 'nexus_module_locks') {
       return res.json({ value: JSON.stringify({ "school-info": false, "esf7": false, "nspp": true, "siif": true }) });
   }
   ```
2. **Implement `POST /api/settings/save`:**
   Allow authorized administrators to persist settings changes (e.g. from the admin dashboard) with parameterized queries and role verification.

### Layer 3: Nexus Dashboard Enhancement (`apps/school-head/web/src/modules/NexusDashboard.jsx`)
1. **Fail-Closed Card State:**
   Update the SIIF card definition:
   ```javascript
   isLocked: dynamicLocks.hasOwnProperty('siif') ? dynamicLocks['siif'] : true, // Fail-closed
   ```
2. **Locked Card Click Modal:**
   When `mod.isLocked` is true and the user clicks the card:
   - Instead of a silent no-op, open an **InsightED Lock / Maintenance Modal** (`LockedModuleModal`).
   - Modal details:
     - Header: DepEd & InsightED Gateway Sentinel
     - Title: "SIIF Hub Access Restricted"
     - Subtitle: "Scheduled Maintenance & Verification Period"
     - Message: "The School Innovation and Intervention Fund (SIIF) Hub is currently undergoing scheduled data consolidation and administrative review. Direct access is temporarily restricted."
     - Actions: "Close / Return to Nexus" button, and an optional "Admin / Preview Bypass" for Super Users.

### Layer 4: Route Guard in `App.jsx` & `SIIFModule.jsx`
1. Protect direct URL navigation to `/siif/*`:
   - If `nexusLocks.siif === true` and the user is a standard School Head (not Admin/Super User and without `?preview=true`), prevent entry and redirect back to `/nodes-dashboard` or render a dedicated `SIIFUnderMaintenance` page.

---

## 🧪 4. Verification & Testing Plan

1. **Database Check:**
   - Run query to confirm `settings.nexus_module_locks` includes `"siif": true`.
2. **Frontend Nexus Test:**
   - Open `/nodes-dashboard`.
   - Verify SIIF card displays `Access Restricted 🔒`, grayscale filter, and `locked` styling.
   - Click the SIIF card: verify the sleek Maintenance Modal opens with explanatory notice and clean dismiss button.
3. **Route Guard Test:**
   - Attempt direct browser navigation to `/siif` and `/siif/forms`.
   - Verify the route guard redirects back to `/nodes-dashboard` or presents the maintenance screen.
4. **Admin Dashboard Test:**
   - In `/admin-dashboard`, test the "Nodes Module Controls" toggle for SIIF Hub.
   - Verify `POST /api/settings/save` updates the database value without errors.
5. **Build Smoke Test:**
   - Run `npm run build` in `apps/school-head/web` to confirm zero syntax or bundling regressions.

---

## ⚡ 5. Master Tinkerer Guardrails Check

- [x] **No DDL changes on hot paths:** No tables dropped or modified.
- [x] **Column Lock preserved:** No database schema identifiers touched.
- [x] **Nuclear Deletion Lock preserved:** Zero `DELETE` or `TRUNCATE` operations.
- [x] **Zero-Trust Input Validation:** All API queries parameterized.
- [x] **Flawless UI Aesthetics:** Modal uses modern Tailwind, Framer Motion, and official InsightED design tokens.
