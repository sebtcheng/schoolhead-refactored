import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def add_pks():
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
            print(f"Adding PRIMARY KEY to {table}...")
            try:
                # First check if 'id' column already exists
                cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}' AND column_name = 'id'")
                if cur.fetchone():
                    print(f"  Column 'id' already exists in {table}. Skipping.")
                    continue
                
                # Add the serial column as a primary key
                cur.execute(f"ALTER TABLE {table} ADD COLUMN id SERIAL PRIMARY KEY;")
                conn.commit()
                print(f"  Successfully added PRIMARY KEY to {table}.")
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
    add_pks()
