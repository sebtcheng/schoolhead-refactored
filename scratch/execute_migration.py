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

def execute_migration():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # 1. Create engineer_dump table if it doesn't exist
        print("Creating engineer_dump table if not exists...")
        cur.execute("SET app.allow_deletions = 'true';")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS engineer_dump (LIKE engineer_form INCLUDING ALL);
        """)
        
        # 2. Identify Projects with Duplicate IPCs
        print("Identifying duplicate IPCs...")
        cur.execute("""
            SELECT ipc FROM engineer_form
            WHERE ipc IS NOT NULL AND ipc != ''
            GROUP BY ipc
            HAVING COUNT(*) > 1
        """)
        dup_ipcs = [row[0] for row in cur.fetchall()]

        # 3. Identify Projects with Media (Photos/Documents)
        print("Identifying projects with media...")
        cur.execute("SELECT DISTINCT project_id FROM engineer_image")
        projects_with_photos = {row[0] for row in cur.fetchall()}
        
        cur.execute("SELECT DISTINCT project_id FROM engineer_documents")
        projects_with_docs = {row[0] for row in cur.fetchall()}
        
        cur.execute("SELECT DISTINCT project_id FROM project_documents")
        projects_with_proj_docs = {row[0] for row in cur.fetchall()}
        
        cur.execute("SELECT DISTINCT project_id FROM hrodi_project")
        projects_with_hrodi = {row[0] for row in cur.fetchall()}
        
        cur.execute("SELECT DISTINCT project_id FROM co_finance")
        projects_with_finance = {row[0] for row in cur.fetchall()}
        
        media_project_ids = projects_with_photos.union(projects_with_docs) \
                            .union(projects_with_proj_docs) \
                            .union(projects_with_hrodi) \
                            .union(projects_with_finance)

        # 4. Identify projects to RETAIN
        # - Those with duplicate IPCs
        # - Those with media
        print("Calculating projects to retain...")
        if dup_ipcs:
            cur.execute("SELECT project_id FROM engineer_form WHERE ipc IN %s", (tuple(dup_ipcs),))
            retain_ipc_ids = {row[0] for row in cur.fetchall()}
        else:
            retain_ipc_ids = set()
            
        retain_ids = retain_ipc_ids.union(media_project_ids)
        print(f"Total projects to retain: {len(retain_ids)}")

        # 5. Identify projects to MOVE
        cur.execute("SELECT project_id FROM engineer_form")
        all_project_ids = {row[0] for row in cur.fetchall()}
        
        move_ids = all_project_ids - retain_ids
        print(f"Total projects to move: {len(move_ids)}")

        if not move_ids:
            print("No projects found to migrate.")
            return

        # 6. Migrate to engineer_dump
        print(f"Migrating {len(move_ids)} projects to engineer_dump...")
        move_ids_tuple = tuple(move_ids)
        
        # Insert into dump
        cur.execute("""
            INSERT INTO engineer_dump 
            SELECT * FROM engineer_form 
            WHERE project_id IN %s
        """, (move_ids_tuple,))
        
        inserted_count = cur.rowcount
        print(f"Successfully inserted {inserted_count} records into engineer_dump.")

        # 7. Delete from engineer_form
        if inserted_count == len(move_ids):
            cur.execute("""
                DELETE FROM engineer_form 
                WHERE project_id IN %s
            """, (move_ids_tuple,))
            deleted_count = cur.rowcount
            print(f"Successfully deleted {deleted_count} records from engineer_form.")
            
            conn.commit()
            print("Migration committed successfully.")
        else:
            print("ERROR: Insert count mismatch. Rolling back.")
            conn.rollback()

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    execute_migration()
