import psycopg2
import os
import re

# Columns excluded from duplicate comparison — these differ legitimately between copies
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

def get_all_columns(cur):
    """Fetches all column names of engineer_form from the DB schema."""
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'engineer_form'
        ORDER BY ordinal_position
    """)
    return [row[0] for row in cur.fetchall()]

def find_duplicates():
    db_url = get_db_url()
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()

        # Dynamically get all columns, exclude the 3 that differ by design
        all_cols = get_all_columns(cur)
        hash_cols = [c for c in all_cols if c not in EXCLUDE_COLS]

        print(f"engineer_form has {len(all_cols)} columns.")
        print(f"Excluded from comparison: {', '.join(sorted(EXCLUDE_COLS))}")
        print(f"Hashing {len(hash_cols)} columns for duplicate detection...\n")

        cols_concat = " || '|' || ".join([f"COALESCE(\"{c}\"::TEXT, '')" for c in hash_cols])

        query = f"""
            WITH hashed AS (
                SELECT
                    project_id,
                    ipc,
                    school_name,
                    project_name,
                    created_at,
                    MD5({cols_concat}) AS row_hash
                FROM engineer_form
            )
            SELECT
                row_hash,
                COUNT(*)                              AS dup_count,
                ARRAY_AGG(project_id ORDER BY project_id DESC) AS project_ids,
                ARRAY_AGG(ipc        ORDER BY project_id DESC) AS ipcs,
                ARRAY_AGG(created_at ORDER BY project_id DESC) AS created_ats,
                MIN(school_name)   AS school_name,
                MIN(project_name)  AS project_name
            FROM hashed
            GROUP BY row_hash
            HAVING COUNT(*) > 1
            ORDER BY dup_count DESC, MIN(school_name);
        """

        print("Running query... (this may take a few seconds on large tables)")
        cur.execute(query)
        duplicates = cur.fetchall()

        if not duplicates:
            print("✅ No duplicate projects found.")
        else:
            print(f"⚠️  Found {len(duplicates)} duplicate group(s):\n")
            print("-" * 70)

            total_extra = 0
            for idx, row in enumerate(duplicates, 1):
                row_hash, dup_count, proj_ids, ipcs, created_ats, school_name, project_name = row
                extra = dup_count - 1
                total_extra += extra

                survivor_id = proj_ids[0]   # highest project_id = latest survivor
                orphan_ids  = proj_ids[1:]

                print(f"{idx}. {school_name} — {project_name}")
                print(f"   Copies      : {dup_count}  (hash: {row_hash[:12]}...)")
                print(f"   SURVIVOR    : project_id={survivor_id}  ipc={ipcs[0]}  created={created_ats[0]}")
                if orphan_ids:
                    for i, oid in enumerate(orphan_ids):
                        print(f"   ORPHAN  [{i+1}] : project_id={oid}  ipc={ipcs[i+1]}  created={created_ats[i+1]}")
                print("-" * 70)

            print(f"\nSummary: {len(duplicates)} duplicate group(s), {total_extra} redundant row(s) to remove.")
            print(f"Survivor rule: highest project_id (latest record) is kept per group.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    find_duplicates()
