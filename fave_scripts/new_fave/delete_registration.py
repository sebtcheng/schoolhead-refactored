import os
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
import sys

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv('DATABASE_URL')

# Tables to clean (Excluding Engineer, PSIP, and NSBI)
# Most use school_id, some also use iern. We will use both if available.
TABLES_TO_CLEAN = [
    # Personnel
    'ph_teachers_list',
    'teaching_personnel',
    'teacher_specialization_details',
    
    # Facilities/Equipment (School-managed)
    'ph_buildings_inventory',
    'ph_buildings_repairs',
    'ph_buildings_demolition',
    'ph_ecart_batches',
    'ph_school_buildable_spaces',
    
    # Profiles & Docs
    'school_profiles',
    'school_location_profiles',
    'school_ownership_docs',
    'school_documents',
    'pending_schools',
    
    # Progress & Metadata
    'ph_school_completion',
    'school_summary',
    'ph_performance_logs',
    
    # Root Records (Delete last)
    'users',
    'ph_schools'
]

def delete_registration():
    print("\n--- InsightEd School Registration Deletion Tool ---")
    print("WARNING: This will permanently delete School Head registration data.")
    print("Excluded: Engineer Records (engineer_form), PSIP, and NSBI masterlists.\n")

    school_id = input("Enter the School ID to DELETE: ").strip()
    if not school_id:
        print("❌ Error: School ID cannot be empty.")
        return

    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cur = conn.cursor()

        # 1. Lookup Info first
        print(f"[LOOKUP] Looking up details for {school_id}...")
        
        # Try ph_schools
        cur.execute("SELECT iern, school_name, region, division FROM ph_schools WHERE school_id = %s", (school_id,))
        row = cur.fetchone()
        
        iern = None
        school_name = "Unknown School"
        region = "Unknown Region"
        division = "Unknown Division"
        
        if row:
            iern, school_name, region, division = row
        else:
            # Try pending_schools
            cur.execute("SELECT school_name, region, division FROM pending_schools WHERE school_id = %s", (school_id,))
            p_row = cur.fetchone()
            if p_row:
                school_name, region, division = p_row

        # Try to find email in users
        cur.execute("SELECT email FROM users WHERE school_id = %s LIMIT 1", (school_id,))
        u_row = cur.fetchone()
        email = u_row[0] if u_row else "Not Found"

        print("\n--- REGISTRATION DETAILS ---")
        print(f" School Name: {school_name}")
        print(f" School ID:   {school_id}")
        print(f" IERN:        {iern if iern else 'N/A'}")
        print(f" Region:      {region}")
        print(f" Division:    {division}")
        print(f" Email:       {email}")
        print("----------------------------\n")

        confirm = input(f"Are you absolutely sure you want to delete registration for {school_name}? (y/N): ").lower()
        if confirm != 'y':
            print("Operation cancelled.")
            return

        if not row:
            print(f"Warning: School ID {school_id} not found in ph_schools. Proceeding with school_id only deletions.")
        else:
            print(f"Proceeding with IERN: {iern}")

        print(f"\nStarting deletion transaction for {school_id}...")
        
        total_deleted = 0
        
        for table in TABLES_TO_CLEAN:
            try:
                # Check if table has iern or school_id column
                cur.execute(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' 
                    AND (column_name = 'school_id' OR column_name = 'iern')
                """)
                cols = [r[0] for r in cur.fetchall()]
                
                if not cols:
                    print(f" [SKIP]    [{table}] No school_id or iern column found.")
                    continue

                conditions = []
                params = []
                
                if 'school_id' in cols:
                    conditions.append("school_id = %s")
                    params.append(school_id)
                
                if 'iern' in cols and iern:
                    conditions.append("iern = %s")
                    params.append(iern)
                
                if not conditions:
                    continue

                # Use OR if both are available to be safe
                query = sql.SQL("DELETE FROM {} WHERE ").format(sql.Identifier(table))
                query += sql.SQL(" OR ").join([sql.SQL(c) for c in conditions])
                
                cur.execute(query, tuple(params))
                count = cur.rowcount
                total_deleted += count
                if count > 0:
                    print(f" [SUCCESS] [{table}] Deleted {count} records.")
                else:
                    print(f" [CLEAN]   [{table}] No records found.")

            except Exception as e:
                print(f" [ERROR]   [{table}] Failed: {str(e)}")
                raise e

        # Final Confirmation
        print(f"\nTotal records deleted: {total_deleted}")
        final_confirm = input("\nCOMMIT changes to database? (yes/no): ").lower()
        
        if final_confirm == 'yes':
            conn.commit()
            print("Registration purged successfully.")
        else:
            conn.rollback()
            print("Rollback performed. No changes made.")

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"\nTransaction failed: {e}")
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    try:
        delete_registration()
    except KeyboardInterrupt:
        print("\n\nOperation aborted.")
        sys.exit(0)
