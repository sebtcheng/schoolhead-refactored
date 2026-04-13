import psycopg2
import os
import re

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    with open(env_path, 'r') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def generate():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url, sslmode='require')
    cur = conn.cursor()

    # Get cols to compare
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'")
    all_cols = [r[0] for r in cur.fetchall() if r[0] not in ['project_id', 'ipc', 'created_at']]
    cols_str = ", ".join([f'"{c}"' for c in all_cols])

    # Get all project_ids that belong to a duplicate group
    query = f"""
        SELECT ARRAY_AGG(project_id) 
        FROM engineer_form 
        GROUP BY {cols_str} 
        HAVING COUNT(*) > 1
    """
    cur.execute(query)
    groups = cur.fetchall()
    
    # Flatten IDs
    ids = [idx for group in groups for idx in group[0]]
    ids.sort()

    output_path = os.path.join(os.path.dirname(__file__), 'duplicate_ids_query.sql')
    with open(output_path, 'w') as f:
        f.write(f"-- Found {len(ids)} duplicate IDs across {len(groups)} groups\n")
        f.write("SELECT * FROM engineer_form\n")
        f.write(f"WHERE project_id IN ({', '.join(map(str, ids))})\n")
        f.write("ORDER BY project_name, created_at;")

    print(f"Generated {output_path} with {len(ids)} IDs.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    generate()
