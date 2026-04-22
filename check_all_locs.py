
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        cur.execute("SELECT DISTINCT region FROM all_locations_district ORDER BY region;")
        regions = cur.fetchall()
        print("--- ALL REGIONS ---")
        for r in regions:
            print(f"'{r[0]}'")
            
        cur.execute("SELECT DISTINCT division FROM all_locations_district WHERE region ILIKE '%%IV-A%%' ORDER BY division;")
        divisions = cur.fetchall()
        print("\n--- ALL DIVISIONS IN REGION IV-A ---")
        for d in divisions:
            print(f"'{d[0]}'")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
