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

def verify():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Count unique BEFF IPCs in EF
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form WHERE ipc IN (SELECT ipc FROM import_beff_projects)")
        beff_in_ef = cur.fetchone()[0]
        print(f"Total Unique BEFF IPCs now in engineer_form: {beff_in_ef}")
        
        # Count total rows in EF
        cur.execute("SELECT COUNT(*) FROM engineer_form")
        total_ef = cur.fetchone()[0]
        print(f"Total Rows in engineer_form: {total_ef}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    verify()
