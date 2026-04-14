import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Reconfigure stdout to use UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

CORRUPTION_MAP = {
    '4c41532050493fefbfbd41532043495459': 'LAS PIÑAS CITY',
    '534349454e43452043495459204f46204d553fefbfbd4f5a': 'SCIENCE CITY OF MUÑOZ'
}

TABLES_TO_SCAN = [
    {'name': 'all_locations', 'columns': ['region', 'division', 'district', 'province', 'municipality', 'legislative_district']}
]

def scan():
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("--- Scanning all_locations for corruption ---")
    for table_info in TABLES_TO_SCAN:
        table_name = table_info['name']
        columns = table_info['columns']
        for column in columns:
            # Check for binary corruption (efbfbd)
            cur.execute(f"""
                SELECT DISTINCT {column}, encode({column}::bytea, 'hex') as hex_val
                FROM {table_name}
                WHERE encode({column}::bytea, 'hex') ILIKE '%efbfbd%'
            """)
            anomalies = cur.fetchall()
            if anomalies:
                print(f"\n⚠️  Found {len(anomalies)} anomalies in {table_name}.{column}:")
                for row in anomalies:
                    val = row[column]
                    hex_val = row['hex_val']
                    print(f"  - \"{val}\" (Hex: {hex_val})")
                    # Auto-heuristic fix
                    suggested = val.replace('\uFFFD', 'Ñ').replace('?Ñ', 'Ñ').replace('??', 'Ñ')
                    print(f"    Suggested fix: \"{suggested}\"")

    cur.close()
    conn.close()

if __name__ == "__main__":
    scan()
