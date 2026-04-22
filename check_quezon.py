
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Check Region
        cur.execute("SELECT DISTINCT region FROM all_locations_district WHERE region ILIKE '%%IV-A%%';")
        r = cur.fetchone()
        region_name = r[0] if r else "NOT FOUND"
        print(f"Region Name: '{region_name}'")
        
        # Check if QUEZON district exists
        cur.execute("SELECT * FROM all_locations_district WHERE region = %s AND division = 'QUEZON' AND district = 'QUEZON';", (region_name,))
        exists = cur.fetchone()
        print(f"Exists: {exists}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
