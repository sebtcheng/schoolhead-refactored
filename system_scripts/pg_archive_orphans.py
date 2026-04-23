import subprocess
import sys
import argparse
import time

# pg_archive_orphans.py - Specialized orphan binary archival utility

# Colors
RED = '\033[0;31m'; GREEN = '\033[0;32m'; YELLOW = '\033[1;33m'; CYAN = '\033[0;36m'; NC = '\033[0m'

# Discovery: 12 reference columns identified across primary and engineer/EFD dashboards
TABLES_TO_CHECK = [
    ("school_documents", "binary_id"),
    ("school_ownership_docs", "binary_id"),
    ("lgu_projects", "binary_id"),
    ("project_documents", "binary_id"),
    ("lgu_image", "binary_id"),
    ("engineer_image", "binary_id"),
    ("engineer_documents", "binary_id"),
    ("engineer_documents", "pow_binary_id"),
    ("engineer_documents", "dupa_binary_id"),
    ("engineer_documents", "contract_binary_id"),
    ("engineer_documents", "rta_binary_id"),
    ("engineer_documents", "moa_binary_id")
]

def header(text):
    print(f"\n{CYAN}{'='*60}{NC}")
    print(f"{CYAN}  Postgres Archive — {text}{NC}")
    print(f"{CYAN}{'='*60}{NC}")

def run_sql(host, user, db, query, timeout=120):
    env = "export PGPASSWORD='<REDACTED_PGB_PASS>'; "
    conn = f"-h {host} -U {user} -d {db}"
    full_cmd = ["ssh", "-o", "BatchMode=yes", f"Administrator1@{host}", f"{env} psql {conn} -t -A -c \"{query}\""]
    try:
        result = subprocess.run(full_cmd, capture_output=True, text=True, check=True, timeout=timeout, encoding='utf-8', errors='replace')
        return result.stdout.strip()
    except Exception as e:
        print(f"{RED}SQL Error: {e}{NC}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Iterative Orphan Binary Archival")
    parser.add_argument("--host", default="20.24.58.49", help="Target VM IP (default: 20.24.58.49)")
    parser.add_argument("--user", default="Administrator1", help="SSH Username")
    parser.add_argument("--db", default="insightEd", help="Target Database")
    parser.add_argument("--batch", type=int, default=100, help="Batch size per cycle (default: 100)")
    
    args = parser.parse_args()
    header(f"Database: {args.db}")

    print(f"{YELLOW}1. Ensuring archive table exists...{NC}")
    run_sql(args.host, args.user, args.db, "CREATE TABLE IF NOT EXISTS unified_binaries_archive (LIKE unified_binaries INCLUDING ALL);")
    run_sql(args.host, args.user, args.db, "DROP INDEX IF EXISTS unified_binaries_archive_hash_idx;") # Relax constraints
    
    # Constructing the surgical search clause
    where_parts = []
    for table, col in TABLES_TO_CHECK:
        where_parts.append(f"NOT EXISTS (SELECT 1 FROM {table} WHERE b.id = {col})")
    where_clause = " AND ".join(where_parts)

    print(f"{YELLOW}2. Calculating orphan count...{NC}")
    total = run_sql(args.host, args.user, args.db, f"SELECT count(*) FROM unified_binaries b WHERE {where_clause};")
    try:
        count = int(total)
        print(f"{GREEN}   Found {count} orphaned binaries.{NC}")
        if count == 0:
            print(f"{GREEN}   Database is already lean. No action required.{NC}")
            return
    except:
        print(f"{RED}   Could not determine orphan count. Aborting.{NC}")
        return

    print(f"{CYAN}3. Starting Iterative Migration...{NC}")
    while True:
        # Move Batch
        move_q = f"INSERT INTO unified_binaries_archive SELECT * FROM unified_binaries b WHERE {where_clause} LIMIT {args.batch} ON CONFLICT (id) DO NOTHING;"
        run_sql(args.host, args.user, args.db, move_q)
        
        # Purge Batch
        purge_q = f"DELETE FROM unified_binaries WHERE id IN (SELECT b.id FROM unified_binaries b WHERE EXISTS (SELECT 1 FROM unified_binaries_archive a WHERE a.id = b.id) AND {where_clause} LIMIT {args.batch});"
        run_sql(args.host, args.user, args.db, purge_q)
        
        rem = run_sql(args.host, args.user, args.db, f"SELECT count(*) FROM unified_binaries b WHERE {where_clause};")
        try:
            remaining = int(rem)
            print(f"   Orphans remaining: {remaining}")
            if remaining == 0: break
        except: break
        time.sleep(0.5)

    print(f"\n{GREEN}Success: Primary index relief applied. All orphans preserved in archive table.{NC}")

if __name__ == "__main__":
    main()
