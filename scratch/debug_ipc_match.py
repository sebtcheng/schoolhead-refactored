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

def debug_match():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        print("Checking distinct categories in engineer_form:")
        cur.execute("SELECT DISTINCT project_category FROM engineer_form")
        for row in cur.fetchall():
            print(f" - '{row[0]}'")
            
        print("\nChecking distinct categories in import_beff_projects:")
        cur.execute("SELECT DISTINCT project_category FROM import_beff_projects")
        for row in cur.fetchall():
            print(f" - '{row[0]}'")

        print("\nChecking sample record from engineer_form (NC):")
        cur.execute("SELECT school_id, funding_year, approved_budget_for_contract, project_category, ipc FROM engineer_form WHERE project_category = 'New Construction' LIMIT 1")
        ef_sample = cur.fetchone()
        if ef_sample:
            sid, fy, abc, pcat, ipc = ef_sample
            print(f"EF Sample: School={sid}, Year={fy}, ABC={abc}, Cat='{pcat}', IPC={ipc}")
            
            print("\nSearching for potential match in BEFF by school_id and year:")
            cur.execute("SELECT school_id, funding_year, approved_budget_for_contract, project_category, ipc FROM import_beff_projects WHERE school_id::text = %s AND funding_year = %s", (str(sid), fy))
            beff_matches = cur.fetchall()
            if beff_matches:
                for b in beff_matches:
                    print(f"BEFF Possible Match: School={b[0]}, Year={b[1]}, ABC={b[2]}, Cat='{b[3]}', IPC={b[4]}")
            else:
                print("No match found in BEFF for this school and year.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    debug_match()
