# 📊 XLSB Storage & Analysis Strategy

This document provides technical guidelines for storing and analyzing **XLSB (Binary Excel)** files within the InsightEd PostgreSQL ecosystem.

## 🧠 The Challenge: XLSB vs XLSX
Unlike XLSX (XML-based), **XLSB** is a compressed binary format. 
- **Storage:** It is smaller than XLSX but cannot be easily inspected as raw text.
- **Analysis:** Parsing requires specialized libraries (e.g., `pyxlsb`) as standard XML parsers will fail.
- **Efficiency:** Already compressed via ZIP/DEFLATE, so additional compression (like Brotli) offers diminishing returns.

---

## 🏗️ Phase 1: Efficient Storage (Registry Pattern)
We use a **Unified Binary Registry** to prevent database bloat and ensure fast retrieval.

### 1. Unified Binaries Table
All XLSB files must be stored in the `unified_binaries` table.
```sql
-- Existing optimization for large blobs
ALTER TABLE unified_binaries ALTER COLUMN content SET STORAGE EXTERNAL;
```

### 2. Deduplication Workflow
Always use the `upsertBinary` logic in `api/utils/binaryPipeline.js`:
- **SHA-256 Hashing:** Before storage, generate a hash. If the hash exists, store only a reference.
- **Immediate UUID Return:** The database acts as a content-addressable store.

---

## 📈 Phase 2: High-Performance Analysis (ETL Pattern)
Storing the binary is not enough for "Data Analysis." We must flatten the data.

### 1. Recommended Analysis Schema
Do **not** parse the XLSB on every `SELECT` query. Instead, extract the data during upload into a structured format:

```sql
CREATE TABLE xlsb_analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binary_id UUID REFERENCES unified_binaries(id),
    sheet_name TEXT,
    data_json JSONB, -- Stores the actual rows for fast querying
    metadata JSONB,   -- Stores headers, row counts, etc.
    processed_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Extraction Pipeline
Use a Python micro-utility or Node.js worker for the heavy lifting:
- **Library:** `pyxlsb` (Python) or `sheetjs` (JS). `pyxlsb` is preferred for extremely large files due to lower memory overhead.
- **Action:** Convert the critical parts of the XLSB into **JSONB**. This allows for indexed searches using `@>` and `?` operators in Postgres.

---

## ⚡ Phase 3: Fast Upload & Reliability
To support 1000+ concurrent users and large files:

1. **Memory Buffering:** Use `multer.memoryStorage()` for small to medium files (<20MB). For larger files, use a streaming multipart parser.
2. **De-blocking:** Run the "Extraction Pipeline" as a **background task** (using `pg-boss` or a simple task queue) so the user gets an immediate success response while the data is being parsed for analysis.
3. **Storage External:** Ensure columns are tuned to `EXTERNAL` to keep the main table indices slim.

---

## 🚀 Massive Scale Analysis: 20MB Per School

If all schools (~50,000 in PH) submit a 20MB XLSB file, the total storage requirement would be approximately **1 TB**.

### 1. Accomodation Feasibility
**Yes**, Azure Database for PostgreSQL can easily accommodate 1 TB. 
- **Storage Scaling:** Azure Postgres Flexible Server supports up to 16 TB or 32 TB of storage. 1 TB is well within the "mid-tier" operational range.
- **Cost:** At current Azure rates, 1 TB of Premium SSD storage costs approximately $100–$150/month.

### 2. Pros & Cons

| Feature | Pros (Storage in DB) | Cons (Storage in DB) |
| :--- | :--- | :--- |
| **Data Integrity** | Files are atomically linked to school records via `binary_id`. | Larger database size increases restore time (RTO). |
| **Consistency** | 100% environment visibility. No disk mount 404s. | High concurrent uploads (1000+) can spike IOPS. |
| **Security** | Access control is handled by existing API Auth logic. | Database backups become significantly larger. |
| **Analysis** | Fast `JOIN` between binary metadata and school info. | Requires careful `TOAST` tuning to avoid table bloat. |

### 3. Recommended Mitigation
To handle the initial burst of 50,000 uploads:
- **Asynchronous ETL:** Do not parse XLSB files on the main request. Move the extraction to a background worker.
- **Chunked Uploads:** Ensure the frontend uses a streaming/chunked upload method for files over 10MB to avoid VM memory exhaustion.
- **PgBouncer:** Use a connection pooler to prevent thousands of mobile connections from overwhelming the Postgres process.

---

## Phase 4: Pre-Upload Optimization (Reducing File Size)

To ensure fast uploads and minimize storage costs, schools should be encouraged to "clean" their workbooks before submission.

### 1. Remove "Ghost" Rows and Columns
Excel often remembers formatting in cells that appear empty. 
- **Action:** Select all rows below the data, right-click and select **Delete**. Repeat for columns to the right of the data. 
- **Result:** This often reduces file size by 20-50% for workbooks that have been reused multiple times.

### 2. Clear Excessive Formatting
Heavy use of conditional formatting and custom styles adds significant weight to binary workbooks.
- **Action:** Use "Clear Formats" on empty areas or non-critical sections.
- **Tip:** Limit conditional formatting to essential status indicators only.

### 3. Data Flattening (Convert to Values)
Complex formulas and external links increase the workbook's overhead.
- **Action:** If the analysis only requires the results, use **Copy > Paste Values** to flatten formulas into static data.
- **Action:** Break external links (`Data > Edit Links > Break Link`) and remove unused Named Ranges.

### 4. Optimize Embedded Media
XLSB is a compressed binary, but high-resolution photos embedded in sheets are still large.
- **Action:** Use Excel's "Compress Pictures" tool (found under Picture Format) to set resolution to "Web (150 ppi)".

---

## 🛡️ Resilience Note
> [!IMPORTANT]
> **Never store raw XLSB pointers on the VM disk.** Disk-based storage leads to 404s during environment migrations. Always rely on the `unified_binaries` registry for 100% persistence and environment-agnostic visibility.
