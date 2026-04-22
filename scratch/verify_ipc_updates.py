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

def verify():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        test_pid = 1108286
        expected_ipc = 'INF-01-2016-04416'
        
        print(f"Verifying PID {test_pid}...")
        
        cur.execute("SELECT ipc FROM engineer_form WHERE project_id = %s", (test_pid,))
        ef_ipc = cur.fetchone()[0]
        print(f"EF IPC: {ef_ipc} (Expected: {expected_ipc})")
        
        cur.execute("SELECT DISTINCT ipc FROM engineer_image WHERE project_id = %s", (test_pid,))
        img_ipcs = [row[0] for row in cur.fetchall()]
        print(f"Image IPCs: {img_ipcs}")
        
        cur.execute("SELECT 1 FROM engineer_projects_inventory WHERE ipc = %s", (expected_ipc,))
        in_inventory = cur.fetchone() is not None
        print(f"In Inventory: {in_inventory}")
        
        # Check summary of all 85
        query = """
        SELECT count(*)
        FROM engineer_form ef
        INNER JOIN import_beff_projects ibp ON 
            TRIM(ef.school_id::text) = TRIM(ibp.school_id::text) AND
            ef.funding_year = ibp.funding_year AND
            TRIM(ef.project_category) = TRIM(ibp.project_category) AND (
                ROUND(ef.approved_budget_for_contract::numeric, 2) = ROUND(ibp.approved_budget_for_contract::numeric, 2) OR
                ROUND((ef.approved_budget_for_contract * 1000000)::numeric, -4) = ROUND(ibp.approved_budget_for_contract::numeric, -4)
            )
        WHERE ef.project_category = 'New Construction'
          AND ef.ipc = ibp.ipc
        """
        cur.execute(query)
        consistent_count = cur.fetchone()[0]
        print(f"\nTotal Consistent 'New Construction' projects now: {consistent_count}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    verify()
