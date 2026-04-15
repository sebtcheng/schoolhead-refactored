### 🐛 Incident Report: Location Table Unique Key Error
**Date:** 2026-04-15 | **Status:** Resolved

**🏷️ Clustering Metadata:**
* **Theme:** Database | **Aspect:** Schema / DBeaver | **Complexity:** Low | **Priority:** P2

#### 1. The Problem & Symptom
* **Symptom:** DBeaver displays a "No unique key" error when attempting to delete or modify rows in the `all_locations_*` tables.
* **Error Snippet:** "There is no physical unique key defined. You can define a custom unique key. Alternatively, DBeaver can use all columns as a unique key, but this can lead to multiple rows modification."

#### 2. Root Cause Analysis (The "Why")
* The tables (`all_locations_barangay`, `all_locations_district`, `all_locations_legdist`, `all_locations_regdiv`, `all_locations_regprov`) were created using the `CREATE TABLE AS SELECT ...` syntax in `scripts/create_location_tables.py`.
* In PostgreSQL, `CREATE TABLE AS` creates a table with data but **does not** carry over indexes, constraints, or primary keys from the source table. This left the new tables without a unique identifier.

#### 3. The Final Fix
* **Fix:** Added a `SERIAL PRIMARY KEY` column named `id` to each of the affected tables.
* **Key Code Changes:**
    * Created `scripts/fix_location_pks.js` to automate the `ALTER TABLE` operations.
    * Ensured SSL was disabled in the connection pool to accommodate the PgBouncer configuration on port `6432`.

#### 4. Observability & Resiliency
* **Verification:** A final verification script `scripts/verify_pks_final.js` confirms that each table now possesses a primary key.
* **Resiliency:** Future table creation scripts should explicitly define primary keys or use migrations to ensure DBeaver and other tools can uniquely identify rows.
