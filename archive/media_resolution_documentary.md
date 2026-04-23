# Technical Documentary: Resolving Media Persistence Errors
**Skillset: Avid Documenter / Workspace Architect**  
**Project:** InsightEd-Mobile-PWA (Division Engineer Refactor)  

---

## 🔍 1. Problem Statement
Users in the Division Engineer module reported recurring failures when uploading PDF documents (POW, DUPA, CONTRACT) and site photos. Uploaded files would frequently "disappear" after a project was saved or upon navigating back to the project profile.

### Root Cause Analysis (RCA)
1.  **Transaction Dependency**: Media persistence was coupled with the main "Save Project" transaction. If the metadata save failed or timed out, the media links were never committed to the database.
2.  **API Fragility**: The backend had redundant, conflicting routes (e.g., `/api/upload-project-document`) with inconsistent field validation (camelCase `projectId` vs. snake_case `project_id`).
3.  **Snapshot Fragmentation**: Media was being linked to specific `project_id` increments. Because the system creates a new database row for every update, media linked to a "Snapshot A" was not automatically visible in "Snapshot B".

---

## 🏛️ 2. Architectural Decision: The "Unit 1 Mirror"
To resolve this, we adopted the **Atomic IPC Persistence** pattern used by School Heads (Unit 1).

### The Decision (ADR)
- **Shift to Atomic Operations**: Decouple media uploads from the global form save. Each file upload is now a self-contained, immediate transaction.
- **IPC as Canonical Key**: Media is now linked via the **IPC (Independent Project Code)**. This ensures that regardless of how many snapshots (versions) a project has, all media remains logically attached to the underlying project lineage.

---

## 🛠️ 3. Implementation Steps

### Phase 1: Backend Consolidation
- **Route Unification**: Deleted redundant endpoints and funneled all document traffic through a single robust handler.
- **Upsert Logic**: Implemented `INSERT ... ON CONFLICT (ipc) DO UPDATE` (or logical equivalent) to ensure only the latest version of a document exists on disk and in the DB.
- **Deterministic Naming**: Files are now saved as `[IPC]_[DOC_TYPE].pdf`, ensuring they overwrite older versions and maintain a permanent URL.

### Phase 2: Frontend Atomic Handlers
- **Individual Controls**: Replaced the batch file-input with per-row **"Upload" buttons** for POW, DUPA, and Contract.
- **Instant Persistence**: Implemented `handleAtomicUpload` in `DetailedProjInfo.jsx`, which triggers a multipart upload immediately upon file selection.
- **User Feedback**: Added success animations and immediate "Download" links to confirm the file is safely on the server before the user ever clicks "Save".

### Phase 3: Aesthetic Alignment
- **Overview Optimization**: Refactored the `ProjectCards` to prioritize the IPC and Accomplishment Percentage, reducing visual clutter.
- **Variation Workflow**: Pruned the general editing modal to focus exclusively on **Variation Orders** and **Realignment**, moving simple metadata updates to a more background-aligned state.

---

## 📊 4. Verification & Health
The **Jarvis Protocol** has been executed to verify system vitals post-refactor. While the application logic is now `HEALTHY`, the host storage remains at `CRITICAL (5%)`, requiring proactive maintenance of the `uploads/` directory.

**Conclusion:** The Division Engineer media system is now persistent, disk-backed, and structurally sound.

---
*Synthesized by Antigravity (Avid Documenter)*
