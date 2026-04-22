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

def final_audit():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        # Total EF count
        cur.execute("SELECT COUNT(*) FROM engineer_form")
        total_ef = cur.fetchone()[0]
        
        # Total BEFF IPCs in EF
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form WHERE ipc IN (SELECT ipc FROM import_beff_projects)")
        beff_ipcs_in_ef = cur.fetchone()[0]
        
        # Total rows in EF that don't match BEFF by IPC
        # Using a join or NOT IN for rows
        cur.execute("""
            SELECT COUNT(*) 
            FROM engineer_form ef 
            WHERE NOT EXISTS (
                SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ef.ipc
            )
        """)
        non_beff_rows = cur.fetchone()[0]
        
        print(f"Total rows in engineer_form: {total_ef}")
        print(f"Total rows that match BEFF masterlist (by IPC): {total_ef - non_beff_rows}")
        print(f"Total rows that DON'T match BEFF masterlist: {non_beff_rows}")
        
        if non_beff_rows > 0:
            print("\nSample Non-BEFF categories:")
            cur.execute("""
                SELECT project_category, COUNT(*) 
                FROM engineer_form ef 
                WHERE NOT EXISTS (
                    SELECT 1 FROM import_beff_projects ibp WHERE ibp.ipc = ef.ipc
                )
                GROUP BY project_category
                ORDER BY COUNT(*) DESC
                LIMIT 5
            """)
            for row in cur.fetchall():
                print(f" - {row[0]}: {row[1]}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    final_audit()
