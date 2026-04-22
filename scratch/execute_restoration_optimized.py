import psycopg2
import os
import re

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        return None
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def execute_optimized():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Step 0: Ensure indexes exist for performance
        print("Ensuring indexes on 'ipc' exist for performance...")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_engineer_dump_ipc ON engineer_dump(ipc)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_engineer_form_ipc ON engineer_form(ipc)")
        conn.commit()

        # Step 1: Identify and Move
        print("Identifying BEFF projects in engineer_dump to restore...")
        query_restore = """
        INSERT INTO engineer_form
        SELECT DISTINCT ON (ed.ipc) ed.*
        FROM engineer_dump ed
        INNER JOIN import_beff_projects ibp ON ed.ipc = ibp.ipc
        LEFT JOIN engineer_form ef ON ed.ipc = ef.ipc
        WHERE ef.ipc IS NULL
        ON CONFLICT (project_id) DO NOTHING
        """
        cur.execute(query_restore)
        restored_count = cur.rowcount
        print(f"Restored {restored_count} records to engineer_form.")

        # Step 2: Delete
        print("Deleting restored records from engineer_dump (Using optimized index)...")
        query_cleanup = """
        DELETE FROM engineer_dump
        WHERE ipc IN (
            SELECT ipc FROM import_beff_projects
        )
        AND EXISTS (
            SELECT 1 FROM engineer_form WHERE engineer_form.ipc = engineer_dump.ipc
        )
        """
        cur.execute(query_cleanup)
        deleted_count = cur.rowcount
        print(f"Deleted {deleted_count} records from engineer_dump.")

        conn.commit()
        print("\nOptimized Restoration successful.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error during optimized restoration: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    execute_optimized()
