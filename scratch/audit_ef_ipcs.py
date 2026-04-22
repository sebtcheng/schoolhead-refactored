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

def audit_ipcs():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM engineer_form")
        total = cur.fetchone()[0]
        print(f"Total Rows in engineer_form: {total}")
        
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form")
        distinct_ipcs = cur.fetchone()[0]
        print(f"Distinct IPCs in engineer_form: {distinct_ipcs}")
        
        cur.execute("SELECT COUNT(*) FROM engineer_form WHERE ipc IS NULL OR ipc = ''")
        blank_ipcs = cur.fetchone()[0]
        print(f"Blank/Null IPCs in engineer_form: {blank_ipcs}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    audit_ipcs()
