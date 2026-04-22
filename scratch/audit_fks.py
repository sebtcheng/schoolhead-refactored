import psycopg2
import os
import re

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at {env_path}")
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def audit_fks():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        cur.execute("""
            SELECT
                tc.table_name, 
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY';
        """)
        
        fks = cur.fetchall()
        print("All Foreign Keys in Database:")
        for row in fks:
            print(f"Table: {row[0]} | Column: {row[1]} | Points to: {row[2]}({row[3]})")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    audit_fks()
