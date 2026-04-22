import psycopg2
import os
import re
import csv
from datetime import datetime

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

def run_audit():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # 1. Identify Projects with Duplicate IPCs in engineer_form
        print("Checking for duplicate IPCs...")
        cur.execute("""
            SELECT ipc, COUNT(*) as count, ARRAY_AGG(project_id ORDER BY project_id DESC) as project_ids
            FROM engineer_form
            WHERE ipc IS NOT NULL AND ipc != ''
            GROUP BY ipc
            HAVING COUNT(*) > 1
        """)
        dup_ipcs = cur.fetchall()

        # 2. Identify Projects with Photos
        print("Checking for projects with photos...")
        cur.execute("""
            SELECT DISTINCT project_id
            FROM engineer_image
        """)
        projects_with_photos = {row[0] for row in cur.fetchall()}

        # 3. Identify Projects with Documents
        print("Checking for projects with documents...")
        cur.execute("""
            SELECT DISTINCT project_id
            FROM engineer_documents
        """)
        projects_with_docs = {row[0] for row in cur.fetchall()}

        # 4. Get project details for all relevant project_ids
        relevant_project_ids = set()
        for _, _, pids in dup_ipcs:
            relevant_project_ids.update(pids)
        relevant_project_ids.update(projects_with_photos)
        relevant_project_ids.update(projects_with_docs)

        if not relevant_project_ids:
            print("No relevant projects found.")
            return

        print(f"Fetching details for {len(relevant_project_ids)} projects...")
        # Use placeholders for the safe list
        cur.execute("""
            SELECT project_id, ipc, school_name, project_name, division, region
            FROM engineer_form
            WHERE project_id IN %s
        """, (tuple(relevant_project_ids),))
        
        project_details = {row[0]: row for row in cur.fetchall()}

        # Compile the report and export to CSV
        print("\n--- AUDIT REPORT ---\n")
        
        # 1. Export Duplicate IPCs
        dup_csv = os.path.join(os.path.dirname(__file__), 'duplicate_ipcs.csv')
        with open(dup_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['IPC', 'Dup_Count', 'Project_ID', 'School_Name', 'Project_Name', 'Division', 'Region'])
            for ipc, count, pids in dup_ipcs:
                for pid in pids:
                    details = project_details.get(pid)
                    if details:
                        _, _, school, proj, div, reg = details
                        writer.writerow([ipc, count, pid, school, proj, div, reg])
        print(f"Exported duplicate IPCs to: {dup_csv}")

        # 2. Export Projects with Media
        media_csv = os.path.join(os.path.dirname(__file__), 'projects_with_media.csv')
        with open(media_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Project_ID', 'IPC', 'Has_Photos', 'Has_Docs', 'School_Name', 'Project_Name', 'Division', 'Region'])
            for pid in sorted(relevant_project_ids):
                has_photo = "YES" if pid in projects_with_photos else "NO"
                has_doc = "YES" if pid in projects_with_docs else "NO"
                
                if has_photo == "YES" or has_doc == "YES":
                    details = project_details.get(pid)
                    if details:
                        _, ipc, school, proj, div, reg = details
                        writer.writerow([pid, ipc, has_photo, has_doc, school, proj, div, reg])
        print(f"Exported projects with media to: {media_csv}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    run_audit()
