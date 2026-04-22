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

def check():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # This count should be relatively fast if indexed or even if table scan due to size
        cur.execute("""
            SELECT COUNT(*) 
            FROM engineer_form ef 
            WHERE NOT EXISTS (
                SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ef.ipc
            )
        """)
        non_beff_count = cur.fetchone()[0]
        print(f"Non-BEFF Count: {non_beff_count}")
        
        # Also check how many have NULL or empty IPC
        cur.execute("SELECT COUNT(*) FROM engineer_form WHERE ipc IS NULL OR ipc = ''")
        null_ipc_count = cur.fetchone()[0]
        print(f"Projects with NULL/Empty IPC: {null_ipc_count}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check()
