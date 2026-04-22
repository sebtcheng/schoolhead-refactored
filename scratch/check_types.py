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

def check_types():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        for table in ['engineer_form', 'engineer_image', 'engineer_documents', 'project_documents', 'hrodi_project', 'co_finance']:
            cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'project_id'")
            row = cur.fetchone()
            if row:
                print(f"Table: {table} | Column: {row[0]} | Type: {row[1]}")
            else:
                print(f"Table: {table} | project_id column NOT FOUND")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_types()
