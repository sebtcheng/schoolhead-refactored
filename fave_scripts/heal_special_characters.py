import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

# Configuration of known corrupted sequences and their targets
# We use hex strings for precision to avoid terminal encoding issues
CORRUPTION_MAP = {
    # LAS PIÑAS CITY case
    '4c41532050493fefbfbd41532043495459': 'LAS PIÑAS CITY',
    
    # SCIENCE CITY OF MUÑOZ case
    '534349454e43452043495459204f46204d553fefbfbd4f5a': 'SCIENCE CITY OF MUÑOZ'
}

# General characters that often get corrupted
SPECIAL_CHARS = {
    'Ñ': ['\uFFFD', '?']
}

TABLES_TO_SCAN = [
    {'name': '"schools_IERN"', 'columns': ['"Division"', '"Region"', '"Province"', '"Municipality"', '"Barangay"', '"School_Name"']},
    {'name': 'ph_schools', 'columns': ['division', 'region', 'province', 'municipality', 'barangay', 'school_name']},
    {'name': 'ph_school_completion', 'columns': ['division', 'region']},
    {'name': 'users', 'columns': ['division', 'region', 'province', 'city', 'barangay']}
]

def heal_database():
    print("--- 🚀 Database Encoding Healing Tool ---")
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        cur = conn.cursor(cursor_factory=RealDictCursor)

        print("\n[STEP 1] Scanning for known corrupted hex patterns...")
        for table_info in TABLES_TO_SCAN:
            table_name = table_info['name']
            columns = table_info['columns']
            
            for column in columns:
                for hex_pattern, target in CORRUPTION_MAP.items():
                    cur.execute(f"""
                        SELECT COUNT(*) as cnt FROM {table_name} 
                        WHERE encode({column}::bytea, 'hex') = %s
                    """, (hex_pattern,))
                    count = cur.fetchone()['cnt']
                    
                    if count > 0:
                        print(f"  ⚠️  Found {count} corrupted rows in {table_name}.{column}")
                        confirm = input(f"      Apply fix to {target}? (y/n/all): ").strip().lower()
                        if confirm in ['y', 'all']:
                            cur.execute(f"""
                                UPDATE {table_name} SET {column} = %s 
                                WHERE encode({column}::bytea, 'hex') = %s
                            """, (target, hex_pattern))
                            print(f"      ✅ Fixed {cur.rowcount} rows.")
                            if confirm != 'all':
                                conn.commit()

        print("\n[STEP 2] Scanning for general encoding artifacts (efbfbd / replacement char)...")
        for table_info in TABLES_TO_SCAN:
            table_name = table_info['name']
            columns = table_info['columns']
            for column in columns:
                cur.execute(f"""
                    SELECT DISTINCT {column}, encode({column}::bytea, 'hex') as hex_val
                    FROM {table_name}
                    WHERE encode({column}::bytea, 'hex') ILIKE '%efbfbd%'
                """)
                anomalies = cur.fetchall()
                if anomalies:
                    print(f"  ⚠️  Found {len(anomalies)} unique anomalies in {table_name}.{column}:")
                    for row in anomalies:
                        current_val = row[column]
                        hex_val = row['hex_val']
                        print(f"      - Current: \"{current_val}\" (Hex: {hex_val})")
                        suggested = current_val.replace('\uFFFD', 'Ñ').replace('?Ñ', 'Ñ').replace('??', 'Ñ') # Heuristic
                        new_val = input(f"      - Replacement (default: {suggested}): ").strip() or suggested
                        
                        if new_val:
                            confirm = input(f"        Update all matching rows to \"{new_val}\"? (y/n): ").strip().lower()
                            if confirm == 'y':
                                cur.execute(f"""
                                    UPDATE {table_name} SET {column} = %s 
                                    WHERE encode({column}::bytea, 'hex') = %s
                                """, (new_val, hex_val))
                                print(f"        ✅ Updated {cur.rowcount} rows.")
                                conn.commit()

        print("\n🎉 [DONE] Database healing session complete.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error: {e}")
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    heal_database()
