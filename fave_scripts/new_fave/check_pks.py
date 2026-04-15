import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check_pks():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        tables = [
            'all_locations_regprov',
            'all_locations_barangay',
            'all_locations_regdiv',
            'all_locations_district',
            'all_locations_legdist'
        ]
        
        print("Checking for Primary Keys:")
        for table in tables:
            cur.execute(f"""
                SELECT
                    kcu.column_name
                FROM
                    information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                WHERE
                    tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_name = '{table}';
            """)
            pk = cur.fetchone()
            print(f"{table}: PK = {pk[0] if pk else 'NONE'}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_pks()
