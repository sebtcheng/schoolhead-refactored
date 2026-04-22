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

def find_mismatch():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Identity all project_ids in engineer_image
        cur.execute("SELECT DISTINCT project_id FROM engineer_image")
        image_ids = {row[0] for row in cur.fetchall()}
        
        # Identify all project_ids in engineer_documents
        cur.execute("SELECT DISTINCT project_id FROM engineer_documents")
        doc_ids = {row[0] for row in cur.fetchall()}
        
        all_media_ids = image_ids.union(doc_ids)

        # Identify move candidates as per execute_migration.py logic
        cur.execute("""
            SELECT ipc FROM engineer_form
            WHERE ipc IS NOT NULL AND ipc != ''
            GROUP BY ipc
            HAVING COUNT(*) > 1
        """)
        dup_ipcs = [row[0] for row in cur.fetchall()]
        
        if dup_ipcs:
            cur.execute("SELECT project_id FROM engineer_form WHERE ipc IN %s", (tuple(dup_ipcs),))
            retain_ipc_ids = {row[0] for row in cur.fetchall()}
        else:
            retain_ipc_ids = set()
            
        cur.execute("SELECT project_id FROM engineer_form")
        all_project_ids = {row[0] for row in cur.fetchall()}
        
        retain_ids = retain_ipc_ids.union(all_media_ids)
        move_ids = all_project_ids - retain_ids
        
        # Check if any move_ids are in engineer_image or engineer_documents
        intersect_image = move_ids.intersection(image_ids)
        intersect_doc = move_ids.intersection(doc_ids)
        
        print(f"Move IDs count: {len(move_ids)}")
        print(f"Intersection with engineer_image: {len(intersect_image)}")
        print(f"Intersection with engineer_documents: {len(intersect_doc)}")
        
        if intersect_image:
            print("Example IDs in engineer_image that were marked for move:")
            print(list(intersect_image)[:5])

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    find_mismatch()
