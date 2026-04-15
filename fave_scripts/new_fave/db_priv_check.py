import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check_privileges():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Check current user
        cur.execute("SELECT current_user;")
        user = cur.fetchone()[0]
        print(f"Current User: {user}")
        
        tables = [
            'all_locations_regprov',
            'all_locations_barangay',
            'all_locations_regdiv',
            'all_locations_district',
            'all_locations_legdist',
            'schools_IERN'
        ]
        
        print("\nTable Privileges for current user:")
        for table in tables:
            cur.execute(f"""
                SELECT privilege_type 
                FROM information_schema.table_privileges 
                WHERE table_name = '{table}' AND grantee = '{user}';
            """)
            privs = [r[0] for r in cur.fetchall()]
            print(f"{table}: {privs if privs else 'NO DIRECT PRIVILEGES (Check inheritance/owner)'}")
            
            # Check owner
            cur.execute(f"""
                SELECT tableowner 
                FROM pg_tables 
                WHERE tablename = '{table}';
            """)
            owner = cur.fetchone()
            print(f"  Owner: {owner[0] if owner else 'Unknown'}")

        # Check for locks
        cur.execute("""
            SELECT count(*) 
            FROM pg_locks l 
            JOIN pg_stat_activity a ON l.pid = a.pid 
            WHERE a.query != 'SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid WHERE a.query != ...';
        """)
        locks = cur.fetchone()[0]
        print(f"\nActive locks: {locks}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_privileges()
