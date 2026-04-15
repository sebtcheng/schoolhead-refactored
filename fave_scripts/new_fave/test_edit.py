import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def test_edit():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Test update on all_locations_regprov
        print("Testing UPDATE on all_locations_regprov...")
        cur.execute("SELECT id, region, province FROM all_locations_regprov LIMIT 1;")
        row = cur.fetchone()
        if not row:
            print("  No data to test update.")
            return
            
        row_id, region, province = row
        print(f"  Existing row: ID={row_id}, Region='{region}', Province='{province}'")
        
        # Update with the same value to be safe, but this tests if update is allowed
        cur.execute("UPDATE all_locations_regprov SET region = %s WHERE id = %s;", (region, row_id))
        conn.commit()
        print("  UPDATE successful.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_edit()
