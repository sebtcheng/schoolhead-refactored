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

def check_non_beff():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Count non-BEFF projects
        query = """
        SELECT COUNT(*) 
        FROM engineer_form ef 
        WHERE NOT EXISTS (
            SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ef.ipc
        )
        """
        cur.execute(query)
        count = cur.fetchone()[0]
        print(f"Projects in engineer_form NOT in import_beff_projects: {count}")
        
        # Distribution by category
        query_cats = """
        SELECT project_category, COUNT(*) 
        FROM engineer_form ef 
        WHERE NOT EXISTS (
            SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ef.ipc
        )
        GROUP BY project_category
        ORDER BY COUNT(*) DESC
        """
        cur.execute(query_cats)
        rows = cur.fetchall()
        print("\nDistribution by Category:")
        for row in rows:
            print(f" - {row[0]}: {row[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_non_beff()
