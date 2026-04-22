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

def restore_projects():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # Step 1: Identify IPCs to move back
        # These are projects in BEFF masterlist that are currently sitting in Dump
        # and NOT already back in EF
        print("Identifying BEFF projects in engineer_dump to restore...")
        query_identify = """
        SELECT COUNT(DISTINCT ed.ipc)
        FROM engineer_dump ed
        INNER JOIN import_beff_projects ibp ON ed.ipc = ibp.ipc
        LEFT JOIN engineer_form ef ON ed.ipc = ef.ipc
        WHERE ef.ipc IS NULL
        """
        cur.execute(query_identify)
        to_restore_count = cur.fetchone()[0]
        print(f"Unique IPCs to restore: {to_restore_count}")

        if to_restore_count == 0:
            print("No projects found in engineer_dump that need restoration.")
            return

        # Step 2: Move records back
        # Since engineer_dump was created as 'SELECT * FROM engineer_form', 
        # the columns match exactly.
        print(f"Restoring projects from engineer_dump to engineer_form...")
        
        # We use a subquery to ensure we only move unique IPCs that aren't already in EF
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

        # Step 3: Delete from Dump (optional but keeps things clean)
        print("Deleting restored records from engineer_dump...")
        query_cleanup = """
        DELETE FROM engineer_dump ed
        WHERE EXISTS (
            SELECT 1 FROM engineer_form ef 
            WHERE ef.ipc = ed.ipc AND ef.project_id = ed.project_id
        )
        AND EXISTS (
            SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ed.ipc
        )
        """
        cur.execute(query_cleanup)
        deleted_count = cur.rowcount
        print(f"Deleted {deleted_count} records from engineer_dump.")

        conn.commit()
        print("\nRestoration successful.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error during restoration: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    restore_projects()
