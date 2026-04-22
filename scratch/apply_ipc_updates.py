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

def apply_updates():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # Step 1: Identify Targets
        query = """
        SELECT 
            ef.project_id,
            ef.ipc AS old_ipc,
            ibp.ipc AS new_ipc
        FROM engineer_form ef
        INNER JOIN import_beff_projects ibp ON 
            TRIM(ef.school_id::text) = TRIM(ibp.school_id::text) AND
            ef.funding_year = ibp.funding_year AND
            TRIM(ef.project_category) = TRIM(ibp.project_category) AND (
                ROUND(ef.approved_budget_for_contract::numeric, 2) = ROUND(ibp.approved_budget_for_contract::numeric, 2) OR
                ROUND((ef.approved_budget_for_contract * 1000000)::numeric, -4) = ROUND(ibp.approved_budget_for_contract::numeric, -4)
            )
        WHERE ef.project_category = 'New Construction'
          AND ef.ipc != ibp.ipc
        """
        
        print("Identifying IPC updates...")
        cur.execute(query)
        targets = cur.fetchall()
        
        if not targets:
            print("No IPC mismatches found for 'New Construction' projects.")
            return

        print(f"Found {len(targets)} projects to update.")

        # Step 2: Apply Updates in Transaction
        # We need to temporarily disable triggers or bypass DocLock if needed
        cur.execute("SET app.allow_deletions = 'true';") # Also often used for updates if lock is strict

        for pid, old_ipc, new_ipc in targets:
            print(f"Updating PID {pid}: '{old_ipc}' -> '{new_ipc}'")
            
            # Step 2a: Handle engineer_projects_inventory carefully (Unique PK on IPC)
            cur.execute("SELECT 1 FROM engineer_projects_inventory WHERE ipc = %s", (new_ipc,))
            exists_in_inventory = cur.fetchone()
            
            if exists_in_inventory:
                print(f"  Note: '{new_ipc}' already exists in inventory. Deleting old record '{old_ipc}' to avoid conflict.")
                cur.execute("DELETE FROM engineer_projects_inventory WHERE ipc = %s", (old_ipc,))
            else:
                cur.execute("UPDATE engineer_projects_inventory SET ipc = %s WHERE ipc = %s", (new_ipc, old_ipc))
            
            # Step 2b: Update other tables
            # Update engineer_form
            cur.execute("UPDATE engineer_form SET ipc = %s WHERE project_id = %s", (new_ipc, pid))
            
            # Update engineer_image
            cur.execute("UPDATE engineer_image SET ipc = %s WHERE project_id = %s", (new_ipc, pid))
            
            # Update engineer_documents
            cur.execute("UPDATE engineer_documents SET ipc = %s WHERE project_id = %s", (new_ipc, pid))
            
            # Update hrodi_project
            cur.execute("UPDATE hrodi_project SET ipc = %s WHERE project_id = %s", (new_ipc, pid))
            
            # Update co_finance
            cur.execute("UPDATE co_finance SET ipc = %s WHERE project_id = %s", (new_ipc, pid))

        conn.commit()
        print("\nAll updates committed successfully.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error during update: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    apply_updates()
