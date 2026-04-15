import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def get_sample_data():
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
        
        for table in tables:
            print(f"\n--- {table} ---")
            cur.execute(f"SELECT * FROM {table} LIMIT 3;")
            rows = cur.fetchall()
            colnames = [desc[0] for desc in cur.description]
            print(f"Columns: {colnames}")
            for row in rows:
                print(row)
                
            # Check for potential unique constraints (excluding NULLs)
            # This is slow, so just check a few combinations
            if table == 'all_locations_district':
                cur.execute("SELECT region, division, district, count(*) FROM all_locations_district GROUP BY region, division, district HAVING count(*) > 1 LIMIT 5;")
                dupes = cur.fetchall()
                print(f"Duplicates (region, division, district): {dupes}")
            elif table == 'all_locations_barangay':
                cur.execute("SELECT region, province, municipality, barangay, count(*) FROM all_locations_barangay GROUP BY region, province, municipality, barangay HAVING count(*) > 1 LIMIT 5;")
                dupes = cur.fetchall()
                print(f"Duplicates (region, province, municipality, barangay): {dupes}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_sample_data()
