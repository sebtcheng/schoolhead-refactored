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

def execute_backfill():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()

        # 1. Identify missing IPCs
        print("Identifying missing projects from BEFF masterlist...")
        query_missing = """
        SELECT ibp.ipc
        FROM import_beff_projects ibp
        LEFT JOIN engineer_form ef ON ibp.ipc = ef.ipc
        LEFT JOIN engineer_dump ed ON ibp.ipc = ed.ipc
        WHERE ibp.ipc IS NOT NULL AND ibp.ipc != ''
          AND ef.ipc IS NULL
          AND ed.ipc IS NULL
        """
        cur.execute(query_missing)
        missing_ipcs = [row[0] for row in cur.fetchall()]
        
        if not missing_ipcs:
            print("No missing projects found to migrate.")
            return

        print(f"Found {len(missing_ipcs)} projects to backfill.")

        # 2. Define Category Mapping
        cat_map = {
            'New Construction': '01',
            'Repair and Rehab': '02',
            'Last Mile Schools': '03',
            'Health facilities': '04',
            'Gabaldon Restoration': '05',
            'Library Hub': '06',
            'SpEd Inclusive Learning Resource Centers (ILRC)': '07',
            'Midrise School Building': '09',
            'Electrification': '12',
            'QRF': '10',
            'Learning Continuity Spaces': '10'
        }

        # 3. Perform Migration in Batches
        batch_size = 500
        total_migrated = 0
        
        # Columns to select from BEFF and insert into EF
        # EF columns: (project_name, school_id, school_name, region, division, funding_year, 
        #              approved_budget_for_contract, contract_amount, contractor_name, 
        #              target_completion_date, actual_completion_date, number_of_classrooms, 
        #              project_category, leg_district, municipality, dpwh_project_id, 
        #              contract_id, accomplishment_percentage, batch_of_funds, 
        #              ipc, project_category_id, approval_status, validation_status, 
        #              uploader_type, created_at)
        
        print(f"Migrating {len(missing_ipcs)} projects to engineer_form...")
        
        for i in range(0, len(missing_ipcs), batch_size):
            batch_ipcs = missing_ipcs[i:i+batch_size]
            
            cur.execute("""
                SELECT 
                    project_name, school_id, school_name, region, division, funding_year, 
                    approved_budget_for_contract, contract_amount, contractor_name, 
                    target_completion_date, actual_completion_date, number_of_classrooms, 
                    project_category, leg_district, municipality, dpwh_project_id, 
                    contract_id, accomplishment_percentage, batch_of_funds, ipc,
                    status_of_construction_phase, other_remarks
                FROM import_beff_projects
                WHERE ipc IN %s
            """, (tuple(batch_ipcs),))
            
            records = cur.fetchall()
            
            for r in records:
                # Prepare values including defaults and mapping
                pname, sid, sname, reg, div, fy, abc, camt, cname, tcd, acd, ncl, pcat, ld, mun, dpwh, cid, ap, bof, ipc, scp, remarks = r
                
                cat_id = cat_map.get(pcat, '10') # Default to '10' if unknown
                
                cur.execute("""
                    INSERT INTO engineer_form (
                        project_name, school_id, school_name, region, division, funding_year, 
                        approved_budget_for_contract, contract_amount, contractor_name, 
                        target_completion_date, actual_completion_date, number_of_classrooms, 
                        project_category, leg_district, municipality, dpwh_project_id, 
                        contract_id, accomplishment_percentage, batch_of_funds, ipc,
                        project_category_id, approval_status, validation_status, 
                        uploader_type, created_at, status_of_construction_phase, other_remarks
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s, %s)
                """, (
                    pname, str(sid), sname, reg, div, fy, abc, camt, cname, tcd, acd, ncl, pcat, ld, mun, dpwh, cid, ap, bof, ipc,
                    cat_id, 'Approved', None, 'System Backfill', scp, remarks
                ))
            
            total_migrated += len(batch_ipcs)
            print(f"Migrated {total_migrated}/{len(missing_ipcs)}...")

        conn.commit()
        print("\nBackfill migration completed successfully.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error during migration: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    execute_backfill()
