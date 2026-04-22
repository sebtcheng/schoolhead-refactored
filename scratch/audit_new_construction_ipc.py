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

def run_audit():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # Audit projects in engineer_form with New Construction category
        # Using a more robust match for ABC (Millions vs Absolute)
        query = """
        SELECT 
            ef.project_id,
            ef.ipc AS ef_ipc,
            ef.school_id,
            ef.funding_year,
            ef.approved_budget_for_contract AS ef_abc,
            ef.project_category,
            ibp.ipc AS beff_ipc,
            ibp.approved_budget_for_contract AS beff_abc,
            ef.school_name,
            ef.project_name
        FROM engineer_form ef
        LEFT JOIN import_beff_projects ibp ON 
            TRIM(ef.school_id::text) = TRIM(ibp.school_id::text) AND
            ef.funding_year = ibp.funding_year AND
            TRIM(ef.project_category) = TRIM(ibp.project_category) AND (
                ROUND(ef.approved_budget_for_contract::numeric, 2) = ROUND(ibp.approved_budget_for_contract::numeric, 2) OR
                ROUND((ef.approved_budget_for_contract * 1000000)::numeric, -4) = ROUND(ibp.approved_budget_for_contract::numeric, -4)
            )
        WHERE ef.project_category = 'New Construction'
        """
        
        print("Running IPC consistency audit for 'New Construction' projects...")
        cur.execute(query)
        rows = cur.fetchall()
        
        mismatches = []
        no_match = []
        consistent = []
        total_retained_nc = len(rows)
        
        for row in rows:
            pid, ef_ipc, school_id, fyear, ef_abc, pcat, beff_ipc, beff_abc, sname, pname = row
            if beff_ipc is None:
                no_match.append(row)
            elif str(ef_ipc).strip() != str(beff_ipc).strip():
                mismatches.append(row)
            else:
                consistent.append(row)
                
        print(f"\nAudit complete for {total_retained_nc} New Construction projects.")
        print(f"Consistent IPCs: {len(consistent)}")
        print(f"IPC Mismatches: {len(mismatches)}")
        print(f"No match found in BEFF: {len(no_match)}")
        
        if mismatches:
            print("\n--- IPC DISCREPANCIES (Existing Match but Different IPC) ---")
            for m in mismatches:
                print(f"PID: {m[0]} | School: {m[2]} ({m[8]}) | Year: {m[3]}")
                print(f"  EF IPC:   {m[1]}")
                print(f"  BEFF IPC: {m[6]}")
                print("-" * 30)

        if no_match:
            print("\n--- NO MATCH FOUND IN BEFF ---")
            for nm in no_match:
                print(f"PID: {nm[0]} | EF IPC: {nm[1]} | School: {nm[2]} ({nm[8]}) | ABC: {nm[4]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    run_audit()
