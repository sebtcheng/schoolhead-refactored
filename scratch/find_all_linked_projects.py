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

def find_linked():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Find all tables with FK to engineer_form
        cur.execute("""
            SELECT conname, 
                   conrelid::regclass AS table_name, 
                   a.attname AS column_name
            FROM pg_constraint c 
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE confrelid = 'engineer_form'::regclass;
        """)
        fks = cur.fetchall()
        
        all_linked_ids = set()
        for fk in fks:
            constraint, table, column = fk
            print(f"Checking table {table} (column {column})...")
            cur.execute(f"SELECT DISTINCT \"{column}\" FROM {table} WHERE \"{column}\" IS NOT NULL")
            ids = {row[0] for row in cur.fetchall()}
            print(f"Found {len(ids)} unique project_ids in {table}")
            all_linked_ids.update(ids)
            
        print(f"\nTotal unique project_ids to RETAIN due to FKs: {len(all_linked_ids)}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    find_linked()
