import psycopg2
import os
import re

EXCLUDE_COLS = {'project_id', 'ipc', 'created_at'}

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at {env_path}")
    with open(env_path, 'r') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def get_hash_columns(cur):
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'engineer_form'
        ORDER BY ordinal_position
    """)
    return [row[0] for row in cur.fetchall() if row[0] not in EXCLUDE_COLS]

def find_duplicates():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()

        hash_cols = get_hash_columns(cur)
        cols_concat = " || '|' || ".join([f"COALESCE(\"{c}\"::TEXT, '')" for c in hash_cols])

        print("Scanning for duplicates...")
        cur.execute(f"""
            WITH hashed AS (
                SELECT
                    project_id,
                    ipc,
                    project_name,
                    MD5({cols_concat}) AS row_hash
                FROM engineer_form
            )
            SELECT
                COUNT(*)                                        AS total_copies,
                MIN(project_name)                               AS project_name,
                ARRAY_AGG(project_id ORDER BY project_id DESC)  AS all_ids,
                ARRAY_AGG(ipc        ORDER BY project_id DESC)  AS all_ipcs
            FROM hashed
            GROUP BY row_hash
            HAVING COUNT(*) > 1
            ORDER BY MIN(project_name);
        """)

        rows = cur.fetchall()

        if not rows:
            print("No duplicates found.")
            return

        total_orphans = sum(r[0] - 1 for r in rows)

        print(f"\nFound {len(rows)} duplicate group(s) — {total_orphans} orphan(s) to be deleted\n")

        for idx, row in enumerate(rows, 1):
            total_copies, project_name, all_ids, all_ipcs = row
            survivor_id  = all_ids[0]
            survivor_ipc = all_ipcs[0]
            orphan_ids   = all_ids[1:]
            orphan_ipcs  = all_ipcs[1:]

            print(f"  {'=' * 55}")
            print(f"  #{idx}  {project_name or 'Unnamed Project'}")
            print(f"  {'=' * 55}")
            print(f"  Duplicate copies : {total_copies}")
            print(f"  {'─' * 55}")
            print(f"  SURVIVOR  →  project_id = {survivor_id:<10}  ipc = {survivor_ipc or 'N/A'}")
            for orphan_id, orphan_ipc in zip(orphan_ids, orphan_ipcs):
                print(f"  ORPHAN    →  project_id = {orphan_id:<10}  ipc = {orphan_ipc or 'N/A'}")
            print()

        print(f"  {'=' * 55}")
        print(f"  SUMMARY")
        print(f"  {'=' * 55}")
        print(f"  Total duplicate groups : {len(rows)}")
        print(f"  Total orphans to delete: {total_orphans}")
        print(f"  {'=' * 55}\n")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    find_duplicates()
