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

def analyze():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Total BEFF
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM import_beff_projects WHERE ipc IS NOT NULL AND ipc != ''")
        total_beff = cur.fetchone()[0]
        
        # BEFF in EF
        cur.execute("""
            SELECT COUNT(DISTINCT ibp.ipc) 
            FROM import_beff_projects ibp 
            JOIN engineer_form ef ON ibp.ipc = ef.ipc
        """)
        in_ef = cur.fetchone()[0]
        
        # BEFF in Dump
        cur.execute("""
            SELECT COUNT(DISTINCT ibp.ipc) 
            FROM import_beff_projects ibp 
            JOIN engineer_dump ed ON ibp.ipc = ed.ipc
        """)
        in_dump = cur.fetchone()[0]
        
        # Missing entirely (the ones I just migrated)
        cur.execute("""
            SELECT COUNT(DISTINCT ibp.ipc) 
            FROM import_beff_projects ibp 
            LEFT JOIN engineer_form ef ON ibp.ipc = ef.ipc
            LEFT JOIN engineer_dump ed ON ibp.ipc = ed.ipc
            WHERE ef.ipc IS NULL AND ed.ipc IS NULL
        """)
        missing = cur.fetchone()[0]
        
        print(f"Total Unique IPCs in import_beff_projects: {total_beff}")
        print(f" - Already in engineer_form:              {in_ef}")
        print(f" - Currently in engineer_dump:             {in_dump}")
        print(f" - Missing from both (just backfilled):   {missing}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    analyze()
