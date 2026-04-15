import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def remove_pks():
    tables = [
        'all_locations_regprov',
        'all_locations_barangay',
        'all_locations_regdiv',
        'all_locations_district',
        'all_locations_legdist'
    ]
    
    conn = None
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        for table in tables:
            print(f"Removing 'id' column from {table}...")
            try:
                cur.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS id;")
                conn.commit()
                print(f"  Successfully removed 'id' column from {table}.")
            except Exception as e:
                conn.rollback()
                print(f"  Error processing {table}: {e}")
                
        cur.close()
    except Exception as e:
        print(f"Connection Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    remove_pks()
