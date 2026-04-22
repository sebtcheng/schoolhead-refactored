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

def check_all_fks():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        cur.execute("""
            SELECT conname, 
                   conrelid::regclass AS table_name, 
                   a.attname AS column_name
            FROM pg_constraint c 
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE confrelid = 'engineer_form'::regclass;
        """)
        fks = cur.fetchall()
        for fk in fks:
            print(f"Constraint: {fk[0]} | Table: {fk[1]} | Column: {fk[2]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_all_fks()
