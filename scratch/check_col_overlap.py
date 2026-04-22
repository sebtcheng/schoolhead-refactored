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

def check_overlap():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'")
        ef_cols = sorted([row[0] for row in cur.fetchall()])
        
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'import_beff_projects'")
        ibp_cols = sorted([row[0] for row in cur.fetchall()])
        
        print("EF Columns:", ef_cols)
        print("\nBEFF Columns:", ibp_cols)
        
        common = sorted(list(set(ef_cols).intersection(set(ibp_cols))))
        print("\nCommon Columns:", common)

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_overlap()
