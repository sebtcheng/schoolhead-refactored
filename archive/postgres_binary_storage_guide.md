# 🗄️ Postgres Unified Binary Storage (Migration Guide)

This document outlines the technical transition from a failing VM-disk-based asset storage system to a robust, environment-agnostic, and compressed **Postgres-based Unified Binary Storage** system.

## 🔴 The Problem (Legacy Disk Storage)
- **Persistent 404s:** Assets stored in VM folders (`/mnt/uploads`) often failed to resolve due to mounting issues or Nginx configuration mismatches.
- **Environment Inconsistency:** Assets uploaded on Staging were invisible on Local/Dev because they relied on a physical disk mount.
- **Table Bloat:** High-resolution JPEGs were being stored as Base64 strings or pointers, leading to unoptimized database growth.

## 🟢 The Solution (Postgres Master Architecture)
We implemented a **Unified Binary Registry** where all project photos and documents are stored as compressed, deduplicated `bytea` blobs directly in the PostgreSQL database.

---

## 🛠️ Step-by-Step Implementation

### Phase 1: Database Schema & Optimization
1.  **Registry Table:** Created `unified_binaries` to serve as a central library for all files.
2.  **TOAST Tuning:** Applied `ALTER TABLE unified_binaries ALTER COLUMN content SET STORAGE EXTERNAL;`. This ensures binary data is stored in specialized TOAST chunks, keeping the main table indices extremely fast.
3.  **Schema Alignment:** Added `binary_id` columns (UUID) to `engineer_image`, `project_documents`, `school_documents`, and `engineer_documents`.

### Phase 2: The "Mutilation" Pipeline (`binaryPipeline.js`)
Implemented a high-frequency utility in `api/utils/binaryPipeline.js` that:
- **SHA-256 Deduplication:** Hashing each file allows us to detect duplicates. If two engineers upload the same 5MB PDF, we only store 5MB once in the database.
- **WebP Strategy:** All incoming photos are automatically shrunken to **WebP (Quality: 65, Max Width: 1200px)** before insertion.
- **PDF Efficiency:** All project documents (POW, DUPA, CONTRACT) are now passed through the deduplication pipeline.

### Phase 3: Backend Buffer Alignment (Multer)
Multer was initially configured for `diskStorage`, which "pre-saved" files to the VM disk and left the backend with an empty buffer.
- **Fix:** Switched project image and document routes to `multer.memoryStorage()`. This ensures the raw file bytes are passed directly to the `upsertBinary` pipeline.
- **Route Refactor:** Updated the following endpoints to use the Postgres Primary path:
    - `POST /api/upload-image`
    - `POST /api/upload-project-document`
    - `POST /api/bulk-upload-project-documents` (Background tasks included)

### Phase 4: Unified Asset Resolution
1.  **The Streamer:** Created a single `/api/asset/:id` endpoint that retrieves the binary content, sets the correct MIME type (e.g. `image/webp` or `application/pdf`), and adds an immutable cache header.
2.  **Frontend Resolution:** Updated `ProjectGallery.jsx` and `DetailedProjInfo.jsx` to resolve `/api/asset/` URLs.

---

## 🚀 Key Results
- **100% Persistence:** Assets are now stored exactly where the data lives (Azure Postgres). They are 100% visible across Local, Staging, and Production instantly.
- **Zero Disk Dependency:** No more 404s caused by VM disk mount failures.
- **Extreme Leanness:** SHA-256 deduplication and WebP compression minimize the storage footprint, ensuring the database remains slim even with thousands of assets.
