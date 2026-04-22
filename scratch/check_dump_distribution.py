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

def check_dump_distribution():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM engineer_dump")
        total = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM engineer_dump WHERE ipc IN (SELECT ipc FROM import_beff_projects)")
        beff_in_dump = cur.fetchone()[0]
        
        print(f"Total in Dump: {total}")
        print(f"BEFF projects in Dump: {beff_in_dump}")
        print(f"Non-BEFF Projects in Dump: {total - beff_in_dump}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_dump_distribution()
