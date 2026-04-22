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

def final_audit():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # This query finds ALL foreign keys pointing to 'engineer_form'
        cur.execute("""
            SELECT
                conname AS constraint_name,
                conrelid::regclass AS table_name,
                confrelid::regclass AS foreign_table_name
            FROM
                pg_constraint
            WHERE
                confrelid = 'engineer_form'::regclass
                AND contype = 'f';
        """)
        
        fks = cur.fetchall()
        print("Definitive Foreign Keys pointing to engineer_form:")
        for row in fks:
            print(f"Constraint: {row[0]} | Source Table: {row[1]} | Target Table: {row[2]}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    final_audit()
