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

def analyze_backfill():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # 1. Total projects in BEFF
        cur.execute("SELECT COUNT(*) FROM import_beff_projects")
        total_beff = cur.fetchone()[0]
        print(f"Total projects in import_beff_projects: {total_beff}")
        
        # 2. Count IPCs already in engineer_form
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form WHERE ipc IS NOT NULL AND ipc != ''")
        ef_ipcs_count = cur.fetchone()[0]
        print(f"Unique IPCs in engineer_form: {ef_ipcs_count}")
        
        # 3. Count IPCs already in engineer_dump
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_dump WHERE ipc IS NOT NULL AND ipc != ''")
        dump_ipcs_count = cur.fetchone()[0]
        print(f"Unique IPCs in engineer_dump: {dump_ipcs_count}")
        
        # 4. Find IPCs in BEFF that are NOT in engineer_form AND NOT in engineer_dump
        query = """
        SELECT COUNT(DISTINCT ibp.ipc)
        FROM import_beff_projects ibp
        LEFT JOIN engineer_form ef ON ibp.ipc = ef.ipc
        LEFT JOIN engineer_dump ed ON ibp.ipc = ed.ipc
        WHERE ibp.ipc IS NOT NULL AND ibp.ipc != ''
          AND ef.ipc IS NULL
          AND ed.ipc IS NULL
        """
        cur.execute(query)
        missing_count = cur.fetchone()[0]
        print(f"Unique IPCs in BEFF MISSING from both EF and Dump: {missing_count}")

        # 5. Check column compatibility for migration
        print("\nChecking column compatibility for migration...")
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'")
        ef_cols = {row[0] for row in cur.fetchall()}
        
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'import_beff_projects'")
        ibp_cols = {row[0] for row in cur.fetchall()}
        
        common_cols = ef_cols.intersection(ibp_cols)
        print(f"Common columns: {len(common_cols)}")
        print(f"Columns in EF missing from BEFF: {ef_cols - ibp_cols}")
        print(f"Columns in BEFF missing from EF: {ibp_cols - ef_cols}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    analyze_backfill()
