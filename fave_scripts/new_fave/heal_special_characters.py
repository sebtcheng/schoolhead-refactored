import os
import sys
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Reconfigure stdout to use UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    masked_url = DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL
    print(f"📡 Using Database: {masked_url}")
else:
    print("❌ Error: DATABASE_URL not found in environment or .env file.")
    sys.exit(1)

# Configuration of known corrupted sequences and their targets
# We use hex strings for precision to avoid terminal encoding issues
CORRUPTION_MAP = {
    # LAS PIÑAS CITY case
    '4c41532050493fefbfbd41532043495459': 'LAS PIÑAS CITY',
    
    # SCIENCE CITY OF MUÑOZ case
    '534349454e43452043495459204f46204d553fefbfbd4f5a': 'SCIENCE CITY OF MUÑOZ'
}

TABLES_TO_SCAN = [
    {'name': 'all_locations', 'columns': ['region', 'division', 'district', 'province', 'municipality', 'legislative_district']},
    {'name': '"schools_IERN"', 'columns': ['Division', 'Region', 'Province', 'Municipality', 'District', 'Barangay', 'School_Name']},
    {'name': 'ph_schools', 'columns': ['division', 'region', 'province', 'municipality', 'district', 'barangay', 'school_name']},
    {'name': 'ph_school_completion', 'columns': ['division', 'region']},
    {'name': 'users', 'columns': ['division', 'region', 'province', 'city', 'barangay']},
    {'name': 'all_locations_deped', 'columns': ['region', 'division', 'district']}
]

def heal_database(auto_heal=False, dry_run=False):
    # If not in auto mode, we should start with a summary scan
    if not auto_heal and not dry_run:
        print("--- 🔍 Preliminary Scan Phase ---")
        # Reuse logic but with dry_run=True to get findings
        perform_scan(dry_run=True, quiet=True)
        print("\n--- 🚀 Interactive Healing Phase ---")
    
    perform_scan(auto_heal=auto_heal, dry_run=dry_run)

def perform_scan(auto_heal=False, dry_run=False, quiet=False):
    conn = None
    try:
        # Use sslmode='prefer' to allow connections to proxies (like PgBouncer 6432) that might not support SSL
        # while still attempting SSL for direct connections.
        conn = psycopg2.connect(DATABASE_URL, sslmode='prefer')
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if not quiet:
            print("\n[STEP 1] Scanning for known corrupted hex patterns...")
        for table_info in TABLES_TO_SCAN:
            table_name = str(table_info['name'])
            columns = table_info['columns']
            
            # Verify table existence
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s OR table_name = %s)", 
                        (table_name.strip('"'), table_name))
            if not cur.fetchone()['exists']:
                if not quiet:
                    print(f"  ⏭️  Skipping missing table: {table_name}")
                continue

            for column in columns:
                safe_column = f'"{column}"' if any(c.isupper() for c in column) else column
                for hex_pattern, target in CORRUPTION_MAP.items():
                    cur.execute(f"SELECT COUNT(*) as cnt FROM {table_name} WHERE encode({safe_column}::bytea, 'hex') = %s", (hex_pattern,))
                    count = cur.fetchone()['cnt']
                    
                    if count > 0:
                        if not quiet:
                            print(f"  ⚠️  Found {count} corrupted rows in {table_name}.{column}")
                            confirm = 'all' if auto_heal else input(f"      Apply fix to {target}? (y/n/all): ").strip().lower()
                            
                            if confirm in ['y', 'all']:
                                if dry_run:
                                    print(f"      [DRY-RUN] Would update {count} rows in {table_name}.{column} to \"{target}\"")
                                else:
                                    cur.execute(f"UPDATE {table_name} SET {safe_column} = %s WHERE encode({safe_column}::bytea, 'hex') = %s", (target, hex_pattern))
                                    print(f"      ✅ Fixed {cur.rowcount} rows.")
                                    conn.commit()
                        else:
                            print(f"  ⚠️  Found {count} potential fixes for \"{target}\" in {table_name}.{column}")

        if not quiet:
            print("\n[STEP 2] Scanning for general encoding artifacts (efbfbd / replacement char)...")
        for table_info in TABLES_TO_SCAN:
            table_name = str(table_info['name'])
            columns = table_info['columns']

            # Verify table existence (re-check in case of disconnects or schema changes)
            cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s OR table_name = %s)", 
                        (table_name.strip('"'), table_name))
            if not cur.fetchone()['exists']:
                continue

            for column in columns:
                safe_column = f'"{column}"' if any(c.isupper() for c in column) else column
                cur.execute(f"SELECT DISTINCT {safe_column}, encode({safe_column}::bytea, 'hex') as hex_val FROM {table_name} WHERE encode({safe_column}::bytea, 'hex') ILIKE '%efbfbd%'")
                anomalies = cur.fetchall()
                if anomalies:
                    if not quiet:
                        print(f"  ⚠️  Found {len(anomalies)} unique anomalies in {table_name}.{column}:")
                    else:
                        print(f"  ⚠️  Found {len(anomalies)} anomalies in {table_name}.{column}")
                        
                    for row in anomalies:
                        current_val = row[column]
                        hex_val = row['hex_val']
                        # Strengthened replacement logic:
                        # Use regex to collapse ANY sequence of '?' or '\uFFFD' into a SINGLE 'Ñ'
                        import re
                        suggested = re.sub(r'[\?\uFFFD]+', 'Ñ', current_val)
                        
                        if not quiet:
                            new_val = None
                            if suggested != current_val:
                                print(f"      - Current: \"{current_val}\" (Hex: {hex_val})")
                                print(f"      - Suggested: \"{suggested}\"")
                                confirm = 'y' if auto_heal else input(f"        Apply suggested fix? (y/n/all): ").strip().lower()
                                if confirm in ['y', 'all']:
                                    new_val = suggested
                                else:
                                    if not auto_heal:
                                        new_val = input(f"        Manual entry: ").strip()
                            else:
                                if not auto_heal:
                                    new_val = input(f"      - Replacement needed (Current: \"{current_val}\", Hex: {hex_val}): ").strip()

                            if new_val:
                                do_update = True if auto_heal else (input(f"        Update matching rows to \"{new_val}\"? (y/n): ").strip().lower() == 'y')
                                if do_update:
                                    if dry_run:
                                        print(f"        [DRY-RUN] Would update rows in {table_name}.{column} with hex {hex_val} to \"{new_val}\"")
                                    else:
                                        cur.execute(f"UPDATE {table_name} SET {safe_column} = %s WHERE encode({safe_column}::bytea, 'hex') = %s", (new_val, hex_val))
                                        print(f"        ✅ Updated {cur.rowcount} rows.")
                                        conn.commit()
                        else:
                            # Just log what we found in quiet/summary mode
                            if suggested != current_val:
                                print(f"      - Potential fix: \"{current_val}\" -> \"{suggested}\"")
                            else:
                                print(f"      - Manual fix needed: \"{current_val}\" (Hex: {hex_val})")

        if not quiet:
            print("\n🎉 Healing session complete.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error: {e}")
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Database Encoding Healing Tool")
    parser.add_argument("--auto", action="store_true", help="Automatically apply suggested fixes")
    parser.add_argument("--fix", action="store_true", help="Start interactive healing session immediately")
    parser.add_argument("--dry-run", action="store_true", help="Scan without applying changes")
    args = parser.parse_args()
    
    # Logic:
    # 1. If --auto: run non-interactively
    # 2. If --dry-run: run scan only
    # 3. If --fix: run interactively immediately
    # 4. Default: run summary scan, then ask to start interactive session
    
    if args.auto or args.dry_run or args.fix:
        heal_database(auto_heal=args.auto, dry_run=args.dry_run)
    else:
        # Default behavior: Dry run summary, then prompt
        print("--- 🚀 Welcome to the Database Encoding Healing Tool ---")
        print("Running preliminary summary scan...")
        heal_database(auto_heal=False, dry_run=True)
        
        confirm = input("\nWould you like to start an interactive healing session? (y/n): ").strip().lower()
        if confirm == 'y':
            heal_database(auto_heal=False, dry_run=False)
