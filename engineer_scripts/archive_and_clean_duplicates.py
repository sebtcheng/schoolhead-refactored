import psycopg2
import os
import re

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    with open(env_path, 'r') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def archive_and_clean():
    db_url = get_db_url()
    if not db_url:
        print("Error: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()

        # --- 1. PREPARATION: Create Archive Table if not exists ---
        print("Phase 1: Preparing Archive Table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS engineer_form_archive (
                LIKE engineer_form INCLUDING ALL
            );
        """)
        
        # Add tracking columns if they don't exist
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form_archive' AND column_name = 'superseded_by_id'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE engineer_form_archive ADD COLUMN archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP")
            cur.execute("ALTER TABLE engineer_form_archive ADD COLUMN superseded_by_id INTEGER")
        
        # --- 2. IDENTIFY DUPLICATES AND PICK SURVIVORS ---
        print("Phase 2: Identifying duplicate groups and selecting survivors (Latest created_at)...")
        # Get comparison columns
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'")
        all_cols = [r[0] for r in cur.fetchall() if r[0] not in ['project_id', 'ipc', 'created_at']]
        cols_str = ", ".join([f'"{c}"' for c in all_cols])

        # Create mapping of (Individual ID -> Survivor ID)
        cur.execute(f"""
            CREATE TEMP TABLE dedup_mapping AS
            WITH ranked_records AS (
                SELECT 
                    project_id,
                    FIRST_VALUE(project_id) OVER (
                        PARTITION BY {cols_str} 
                        ORDER BY created_at DESC, project_id DESC
                    ) as survivor_id
                FROM engineer_form
            )
            SELECT project_id as orphan_id, survivor_id
            FROM ranked_records
            WHERE project_id != survivor_id;
        """)
        
        cur.execute("SELECT COUNT(*) FROM dedup_mapping")
        orphan_count = cur.fetchone()[0]
        
        if orphan_count == 0:
            print("No duplicates found to clean. Operation aborted.")
            return

        print(f"Found {orphan_count} redundant records to archive and remove.")

        # --- 3. EXECUTION: Archive, Relink, Purge ---
        print("\nPhase 3: Executing Cleanup in a single transaction...")
        
        # a. Archive redundant records
        print(" - Archiving records into engineer_form_archive...")
        cur.execute("""
            INSERT INTO engineer_form_archive 
            SELECT ef.*, CURRENT_TIMESTAMP, dm.survivor_id
            FROM engineer_form ef
            JOIN dedup_mapping dm ON ef.project_id = dm.orphan_id;
        """)

        # b. Relink child tables
        # Tables with NO uniqueness constraint on project_id (Multi-record allowed)
        multi_tables = ['engineer_image', 'project_documents']
        # Tables WITH uniqueness constraint on project_id (Single-record only)
        unique_tables = ['hrodi_project', 'co_finance', 'engineer_documents']

        for table in multi_tables:
            print(f" - Re-linking records in {table} (Multi-record)...")
            cur.execute(f"""
                UPDATE "{table}" t
                SET project_id = dm.survivor_id
                FROM dedup_mapping dm
                WHERE t.project_id = dm.orphan_id;
            """)
            print(f"   Updated {cur.rowcount} rows in {table}.")

        for table in unique_tables:
            print(f" - Re-linking records in {table} (Handling Unique Constraint)...")
            # Only update if the survivor doesn't already have a record in this table
            cur.execute(f"""
                UPDATE "{table}" t
                SET project_id = dm.survivor_id
                FROM dedup_mapping dm
                WHERE t.project_id = dm.orphan_id
                AND NOT EXISTS (
                    SELECT 1 FROM "{table}" t2 
                    WHERE t2.project_id = dm.survivor_id
                );
            """)
            print(f"   Updated {cur.rowcount} rows in {table} (Conflicts skipped for safety).")

        # c. Delete from engineer_form
        print(" - Purging redundant records from engineer_form...")
        cur.execute("""
            DELETE FROM engineer_form
            WHERE project_id IN (SELECT orphan_id FROM dedup_mapping);
        """)
        
        print("\nFinalizing...")
        conn.commit()
        print(f"SUCCESS: Archived and removed {orphan_count} duplicate records.")

    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        print(f"Error: {str(e)}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    archive_and_clean()
