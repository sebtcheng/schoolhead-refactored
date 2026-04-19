import psycopg2
import os
import re
import sys

def get_db_url():
    # Try looking in .env in parent directory
    env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        
    try:
        with open(env_path, 'r') as f:
            content = f.read()
            match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
            if match:
                url = match.group(1).strip().strip("'").strip('"')
                # Force standard port and hostname if needed (Bypassing PgBouncer issues if any)
                url = url.replace(':6432', ':5432').replace('20.24.58.49', 'stride-posgre-prod-01.postgres.database.azure.com')
                return url
    except Exception:
        pass
    
    # Fallback to env var
    return os.environ.get('DATABASE_URL')

def fix_duplicates():
    db_url = get_db_url()
    if not db_url:
        print("Error: DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()
        
        print("--- 🔧 Engineer Form: Digital Clone Mitigation Utility ---")

        # 1. PREPARATION: Ensure Duplicates Table exists
        print("\n[Phase 1] Ensuring Archive Infrastructure...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS engineer_forms_duplicates (
                LIKE engineer_form INCLUDING ALL
            );
        """)
        
        # Add tracking columns if missing
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_forms_duplicates' AND column_name = 'archived_at'")
        if not cur.fetchone():
            print(" - Adding tracking columns to duplicates table...")
            cur.execute("ALTER TABLE engineer_forms_duplicates ADD COLUMN archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP")
            cur.execute("ALTER TABLE engineer_forms_duplicates ADD COLUMN superseded_by_id INTEGER")

        # 2. IDENTIFY: CPK-Based Deduplication with Ledger Preservation
        print("\n[Phase 2] Identifying Digital Clones across IPCs...")
        # Rule: Partition by Conceptual Project Key (CPK)
        # Preserve vertical history (same IPC) but archive horizontal clones (different IPC)
        cur.execute("""
            CREATE TEMP TABLE clone_map AS
            WITH ipc_ranks AS (
                 SELECT 
                    ipc,
                    FIRST_VALUE(ipc) OVER (
                        PARTITION BY 
                            school_id, 
                            funding_year, 
                            (CASE WHEN project_category_id = '10' THEN '00' ELSE project_category_id END), -- Group unknown with specific
                            ROUND(COALESCE(approved_budget_for_contract, 0) / 100) * 100
                        ORDER BY 
                            (CASE WHEN project_category_id != '10' THEN 1 ELSE 0 END) DESC, -- Prefer specific category
                            accomplishment_percentage DESC, 
                            project_id DESC
                    ) as survivor_ipc
                FROM engineer_form
                WHERE school_id IS NOT NULL AND funding_year IS NOT NULL
            )
            SELECT e.project_id
            FROM engineer_form e
            JOIN (SELECT DISTINCT ipc, survivor_ipc FROM ipc_ranks) r ON e.ipc = r.ipc
            WHERE e.ipc != r.survivor_ipc;
        """)
        
        cur.execute("SELECT COUNT(*) FROM clone_map")
        clone_count = cur.fetchone()[0]
        print(f" - Found {clone_count} cross-IPC clones to archive.")

        # 3. IDENTIFY: Nameless Ghost Purge
        print("\n[Phase 3] Searching for nameless ghost entries...")
        cur.execute("""
            CREATE TEMP TABLE ghost_map AS
            WITH named_projects AS (
                SELECT school_id, funding_year, ROUND(COALESCE(approved_budget_for_contract, 0) / 100) * 100 as fuzzy_budget
                FROM engineer_form
                WHERE project_name IS NOT NULL AND project_name != ''
            )
            SELECT e.project_id
            FROM engineer_form e
            JOIN named_projects np ON e.school_id = np.school_id 
                AND e.funding_year = np.funding_year
                AND ROUND(COALESCE(e.approved_budget_for_contract, 0) / 100) * 100 = np.fuzzy_budget
            WHERE (e.project_name IS NULL OR e.project_name = '')
              AND e.accomplishment_percentage < 10;
        """)
        
        cur.execute("SELECT COUNT(*) FROM ghost_map")
        ghost_count = cur.fetchone()[0]
        print(f" - Found {ghost_count} additional nameless ghosts mirroring named projects.")

        # 4. EXECUTION: Move and Purge
        total_orphans = clone_count + ghost_count
        if total_orphans == 0:
            print("\n✅ Database is clean. No action needed.")
            return

        print(f"\n[Phase 4] Executing archival of {total_orphans} records...")
        
        # Get column list for safe INSERT
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form' ORDER BY ordinal_position")
        columns = [f'"{r[0]}"' for r in cur.fetchall()]
        col_list = ", ".join(columns)
        ef_col_list = ", ".join([f'ef.{c}' for c in columns])

        # Composite map of all orphans
        cur.execute("""
            CREATE TEMP TABLE final_orphan_map AS
            SELECT project_id FROM clone_map
            UNION
            SELECT project_id FROM ghost_map;
        """)

        # Transactional Archive
        print(" - Moving records to engineer_forms_duplicates...")
        cur.execute(f"""
            INSERT INTO engineer_forms_duplicates ({col_list}, archived_at)
            SELECT {ef_col_list}, CURRENT_TIMESTAMP
            FROM engineer_form ef
            JOIN final_orphan_map fom ON ef.project_id = fom.project_id;
        """)

        print(" - Purging orphans from engineer_form...")
        cur.execute("DELETE FROM engineer_form WHERE project_id IN (SELECT project_id FROM final_orphan_map)")

        # 5. POST-PROCESS: Backfill Hashes
        print("\n[Phase 5] Hardening project ledger (Backfilling Hashes)...")
        cur.execute("""
            UPDATE engineer_form
            SET content_hash = md5(
                COALESCE(school_id::text,'') || '|' || COALESCE(project_name::text,'') || '|' || COALESCE(project_category::text,'') || '|' ||
                COALESCE(status_of_construction_phase::text,'') || '|' || COALESCE(accomplishment_percentage::text,'') || '|' || COALESCE(status_as_of::text,'') || '|' ||
                COALESCE(approved_budget_for_contract::text,'') || '|' || COALESCE(contract_amount::text,'') || '|' || COALESCE(notice_to_proceed::text,'') || '|' ||
                COALESCE(contractor_name::text,'') || '|' || COALESCE(batch_of_funds::text,'') || '|' || COALESCE(funding_year::text,'')
            )
            WHERE content_hash IS NULL;
        """)
        print(f" - Backfilled hashes for {cur.rowcount} records.")

        conn.commit()
        print(f"\n🚀 SUCCESS: Database maintenance complete. Archived {total_orphans} redundant records.")

    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        print(f"❌ ERROR: {str(e)}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    fix_duplicates()
