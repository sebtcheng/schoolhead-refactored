
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        print("--- REGIONS matching 'IV-A' ---")
        cur.execute("SELECT DISTINCT region FROM all_locations_district WHERE region ILIKE '%%IV-A%%' ORDER BY region;")
        for r in cur.fetchall():
            print(f"Region: '{r[0]}'")
            
        print("\n--- DIVISIONS in Region IV-A (or similar) ---")
        cur.execute("SELECT DISTINCT division FROM all_locations_district WHERE (region ILIKE '%%IV-A%%') AND (division ILIKE '%%Quezon%%') ORDER BY division;")
        for d in cur.fetchall():
            print(f"Division: '{d[0]}'")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
