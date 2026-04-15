import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check_rls_triggers():
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
            # Check for RLS
            cur.execute(f"SELECT relrowsecurity FROM pg_class WHERE relname = '{table}';")
            rls = cur.fetchone()
            print(f"  RLS Enabled: {rls[0] if rls else 'N/A'}")
            
            # Check for triggers
            cur.execute(f"SELECT tgname FROM pg_trigger WHERE tgrelid = '{table}'::regclass AND tgisinternal = false;")
            triggers = cur.fetchall()
            print(f"  Triggers: {[t[0] for t in triggers]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_rls_triggers()
