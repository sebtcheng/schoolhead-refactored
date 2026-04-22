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

def list_tables():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
        tables = cur.fetchall()
        for t in tables:
            print(t[0])
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    list_tables()
