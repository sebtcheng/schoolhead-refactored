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

def check_indexes():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        print("EF Indexes:")
        cur.execute("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'engineer_form'")
        for row in cur.fetchall():
            print(f" - {row[0]}: {row[1]}")
            
        print("\nBEFF Indexes:")
        cur.execute("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'import_beff_projects'")
        for row in cur.fetchall():
            print(f" - {row[0]}: {row[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_indexes()
