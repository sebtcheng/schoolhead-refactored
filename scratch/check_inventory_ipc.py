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

def check_ipc():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        target_ipc = 'INF-10-2016-02699'
        print(f"Checking records for IPC: {target_ipc}")
        cur.execute("SELECT * FROM engineer_projects_inventory WHERE ipc = %s", (target_ipc,))
        row = cur.fetchone()
        if row:
            print(f"Found record: {row}")
        else:
            print("No record found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_ipc()
