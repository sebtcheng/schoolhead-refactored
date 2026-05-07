# 🚨 Error Documentor Log

This document tracks critical errors, their root causes, and the surgical solutions implemented in the **InsightEd School Head** project.

---

## [2026-05-07] 500 Internal Server Error on SIIF Submission

### 🔴 Problem
Users encountered a **500 Internal Server Error** when clicking "Confirm & Submit Plan" in the SIIF module. The browser console showed:
`Error submitting: Failed to execute 'json' on 'Response': Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

### 🔍 Root Cause
1.  **Identity Resolution Mismatch**: The backend was expecting a 6-digit `school_id`, but the frontend was sending a long UUID (from the `users` table). This caused a mismatch when querying existing records or building child IDs.
2.  **Database Connection Leak**: The `pool.connect()` call in the backend was located *outside* the `try-catch` block. When the database connection timed out or failed, the server crashed and returned an HTML error page instead of a JSON error.
3.  **Row Deletion Trigger**: A database trigger (`trg_prevent_deletion_siif_submissions`) was blocking the `DELETE` operation used in the backend's "Delete-then-Insert" logic.

### 🛠️ Solution
1.  **Surgical ID Lookup**: Refactored the backend to always resolve the `school_id` from the `users` table using the email in the JWT token.
2.  **Backend Hardening**: Moved `pool.connect()` inside the transaction `try-catch` block to ensure all failures return JSON.
3.  **Bypass Trigger**: Added `SET LOCAL internal.authorized_app_deletion = 'true'` before the `DELETE` command to bypass the row-level lock.
4.  **Frontend Parsing**: Updated `SIIFFormsHub.jsx` to read `res.text()` and manually parse JSON to avoid the "Unexpected token <" crash.

---

## [2026-05-07] Budget Auto-Capping & Submission Gate

### 🔴 Problem
The UI was automatically capping budget inputs to the allocation limit, preventing users from entering their actual estimated needs if they were over budget. Additionally, the system allowed users to submit plans even if they were over budget without a hard block.

### 🔍 Root Cause
1.  **Input Filtering**: `BudgetCard.jsx` had logic that restricted `numVal` to be no greater than the remaining allocation.
2.  **Weak Gate**: The submission gate used `window.confirm`, which users could simply bypass by clicking "OK".

### 🛠️ Solution
1.  **Removed Auto-Cap**: Deleted the restricting logic in `BudgetCard.jsx` to allow free text entry.
2.  **Hard Block**: Implemented an `alert()` and `return` logic in both `BudgetCard.jsx` (Save) and `SIIFFormsHub.jsx` (Submit) if the total budget exceeds the allocation.
3.  **Visual Indicators**: Added red text indicators and "Over Allocation Limit" button states to clearly signal the violation.

---

## [2026-05-07] Activities Summary Categorization

### 🔴 Problem
The Activities summary screen showed all selected activities in a single flat list, making it difficult to distinguish between SIP-AIP aligned activities, Action Research, and Remaining Balance activities.

### 🔍 Root Cause
The `ActivitiesCard.jsx` summary view used `Object.values(acts).flat().map(...)`, which discarded the category information.

### 🛠️ Solution
Refactored `renderSummaryScreen` to iterate through the explicit categories (`sip_aip`, `action_research`, `remaining`) and display them under their respective headers.

---

## [2026-05-07] Missing "status" Column in siif_submissions

### 🔴 Problem
Submissions failed with a database error: `column "status" of relation "siif_submissions" does not exist`.

### 🔍 Root Cause
The backend `INSERT` statement in `api/index.js` included a `status` column, but the actual table schema in the database was missing this field. This discrepancy likely occurred during a previous schema refactor where the column was either dropped or not included in the migration.

### 🛠️ Solution
1.  **Schema Migration**: Executed `ALTER TABLE siif_submissions ADD COLUMN status VARCHAR(20) DEFAULT 'draft';` to sync the database with the API's expectations.
2.  **Verification**: Verified the column existence using a custom schema-check script.
