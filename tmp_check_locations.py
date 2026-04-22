
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def check_locations():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        print("Checking Regions...")
        cur.execute("SELECT DISTINCT region FROM all_locations_district WHERE region ILIKE '%%IV-A%%' ORDER BY region")
        regions = cur.fetchall()
        for r in regions:
            print(f"Region: {r[0]}")
            
        print("\nChecking Divisions in Region IV-A...")
        cur.execute("SELECT DISTINCT division FROM all_locations_district WHERE region ILIKE '%%IV-A%%' AND (division ILIKE '%%Quezon%%' OR division ILIKE '%%Division%%') ORDER BY division")
        divisions = cur.fetchall()
        for d in divisions:
            print(f"Division: {d[0]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_locations()
