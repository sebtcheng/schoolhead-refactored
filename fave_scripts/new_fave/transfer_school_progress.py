import os
import sys
import psycopg2
import traceback
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env')

DATABASE_URL = os.getenv('DATABASE_URL')

# Comprehensive list of tables to check for school_id / iern
TABLES_TO_SCAN = [
    'users', 'ph_schools', 'ph_school_completion', 'engineer_form', 
    'school_profiles', 'school_ownership_docs', 'ph_buildings_inventory', 
    'ph_buildings_repairs', 'ph_inventory_repairs', 'ph_school_buildable_spaces', 
    'school_documents', 'facility_inventory', 'facility_rooms', 
    'facility_repairs', 'pending_schools', 'ph_teachers_list', 
    'teaching_personnel', 'teacher_specialization_details', 
    'ph_buildings_demolition', 'ph_ecart_batches', 'school_location_profiles', 
    'school_summary', 'ph_performance_logs', 'audit_feedback_tasks', 
    'esf7_staging_repairs', 'ph_schools_audit'
]

def transfer_progress():
    print("\n--- InsightEd School Progress Transfer Tool (v2: IERN Support) ---")
    print("This tool migrates all audit progress from an OLD School ID/IERN to a NEW one.")

    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in environment.")
        return

    old_id = input("\nEnter the OLD School ID (source): ").strip()
    new_id = input("Enter the NEW School ID (target): ").strip()

    if not old_id or not new_id:
        print("❌ Error: Both School IDs are required.")
        return

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='prefer')
        conn.autocommit = False
        cur = conn.cursor()

        # 1. Lookup Info (including IERN)
        print(f"\n[LOOKUP] Verifying IDs and retrieving IERNs...")
        
        cur.execute('SELECT "School_Name", "iern" FROM "schools_IERN" WHERE "SchoolID" = %s', (old_id,))
        old_row = cur.fetchone()
        if not old_row:
            print(f"❌ Error: Source School ID {old_id} not found in schools_IERN.")
            return
        old_name, old_iern = old_row
        
        cur.execute('SELECT "School_Name", "iern", "status" FROM "schools_IERN" WHERE "SchoolID" = %s', (new_id,))
        new_row = cur.fetchone()
        if not new_row:
            print(f"❌ Error: Target School ID {new_id} not found in schools_IERN.")
            return
        new_name, new_iern, new_status = new_row

        print(f"Source: {old_id} | IERN: {old_iern} | Name: {old_name}")
        print(f"Target: {new_id} | IERN: {new_iern} | Name: {new_name} | Status: {new_status}")

        # 2. Survey records
        print(f"\n[SURVEY] Scanning tables...")
        total_found = 0
        migration_plan = []

        for table in TABLES_TO_SCAN:
            try:
                # Discover columns
                cur.execute(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table}' 
                    AND (column_name = 'school_id' OR column_name = 'SchoolID' OR column_name = 'iern')
                """)
                cols = [r[0] for r in cur.fetchall()]
                
                if not cols:
                    continue

                # Prepare check query
                conditions = []
                params = []
                if 'school_id' in cols:
                    conditions.append(f'"{table}"."school_id" = %s')
                    params.append(old_id)
                elif 'SchoolID' in cols:
                    conditions.append(f'"{table}"."SchoolID" = %s')
                    params.append(old_id)
                
                if 'iern' in cols and old_iern:
                    conditions.append(f'"{table}"."iern" = %s')
                    params.append(old_iern)

                if not conditions:
                    continue

                check_query = f'SELECT COUNT(*) FROM "{table}" WHERE ' + " OR ".join(conditions)
                cur.execute(check_query, tuple(params))
                count = cur.fetchone()[0]

                if count > 0:
                    print(f" 📦 Found {count} records in '{table}'. Columns: {', '.join(cols)}")
                    migration_plan.append({'table': table, 'cols': cols, 'count': count})
                    total_found += count
            
            except psycopg2.errors.UndefinedTable:
                conn.rollback()
                continue
            except Exception as e:
                print(f" ⚠️ Skip {table}: {e}")
                conn.rollback()

        if total_found == 0:
            print("⚪ No records found to transfer.")
            return

        # 3. Confirmation
        confirm = input(f"\nFound {total_found} records. Transfer to {new_id}/{new_iern}? (yes/no): ").strip().lower()
        if confirm != 'yes':
            print("🚫 Operation cancelled.")
            return

        # 4. Perform Migration
        print("\n🚀 Starting migration (bypassing constraints)...")
        
        try:
            # Attempt to bypass constraints for this session
            cur.execute("SET session_replication_role = 'replica'")
        except Exception as e:
            conn.rollback()
            print(f"⚠️ Warning: Could not set session_replication_role. Falling back to default mode. ({e})")
            # Restart transaction if failed
            cur = conn.cursor()

        try:
            for plan in migration_plan:
                table = plan['table']
                cols = plan['cols']
                
                update_parts = []
                update_params = []
                
                if 'school_id' in cols:
                    update_parts.append('"school_id" = %s')
                    update_params.append(new_id)
                if 'SchoolID' in cols:
                    update_parts.append('"SchoolID" = %s')
                    update_params.append(new_id)
                if 'iern' in cols:
                    update_parts.append('"iern" = %s')
                    update_params.append(new_iern)
                
                # Conditions
                where_parts = []
                where_params = []
                if 'school_id' in cols:
                    where_parts.append('"school_id" = %s')
                    where_params.append(old_id)
                elif 'SchoolID' in cols:
                    where_parts.append('"SchoolID" = %s')
                    where_params.append(old_id)
                
                if 'iern' in cols and old_iern:
                    where_parts.append('"iern" = %s')
                    where_params.append(old_iern)

                # Special case or general update?
                # If target record already exists in ph_schools, we might need a merge or simple update
                if table == 'ph_schools':
                    cur.execute(f'UPDATE "{table}" SET "school_id" = %s, "iern" = %s WHERE "school_id" = %s OR "school_id" = %s', 
                               (new_id, new_iern, old_id, new_id))
                    print(f" ✅ {table}: Updated/Finalized parent record.")
                else:
                    update_query = f'UPDATE "{table}" SET ' + ", ".join(update_parts) + " WHERE " + " OR ".join(where_parts)
                    cur.execute(update_query, tuple(update_params + where_params))
                    print(f" ✅ {table}: Updated {plan['count']} rows.")

            # 5. Archive old ID
            print(f" 📦 Archiving source ID {old_id} in 'schools_IERN'.")
            cur.execute('UPDATE "schools_IERN" SET "status" = \'Archived\', "updated_at" = CURRENT_TIMESTAMP WHERE "SchoolID" = %s', (old_id,))
            
            # Reset role
            try:
                cur.execute("SET session_replication_role = 'origin'")
            except:
                pass
                
            conn.commit()
            print(f"\n🎉 SUCCESS: Data migration complete. {total_found} records moved.")

        except Exception as e:
            try:
                cur.execute("SET session_replication_role = 'origin'")
            except:
                pass
            raise e

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\n❌ ERROR: Transfer failed.")
        traceback.print_exc()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    try:
        transfer_progress()
    except KeyboardInterrupt:
        print("\n\nOperation aborted.")
        sys.exit(0)
