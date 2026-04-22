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

def kill_blocking():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        blocking_pid = 1710004
        print(f"Attempting to kill blocking PID {blocking_pid}...")
        cur.execute(f"SELECT pg_terminate_backend({blocking_pid})")
        res = cur.fetchone()[0]
        print(f"Killed: {res}")
        
        # Also kill the blocked index process if it doesn't wake up
        blocked_pid = 1713244
        print(f"Attempting to kill blocked PID {blocked_pid}...")
        cur.execute(f"SELECT pg_terminate_backend({blocked_pid})")
        res = cur.fetchone()[0]
        print(f"Killed: {res}")
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    kill_blocking()
