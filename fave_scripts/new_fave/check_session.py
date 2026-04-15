import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check_session_vars():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        vars_to_check = [
            'transaction_read_only',
            'default_transaction_read_only',
            'session_replication_role',
            'server_version',
            'in_hot_standby'
        ]
        
        print("Session Variables:")
        for var in vars_to_check:
            try:
                cur.execute(f"SHOW {var};")
                val = cur.fetchone()[0]
                print(f"  {var}: {val}")
            except Exception as e:
                # in_hot_standby might not exist depending on PG version
                if 'in_hot_standby' in var:
                    cur.execute("SELECT pg_is_in_recovery();")
                    val = cur.fetchone()[0]
                    print(f"  pg_is_in_recovery(): {val}")
                else:
                    print(f"  {var}: Error - {e}")
        
        # Check database level read-only
        cur.execute("SELECT datname, datallowconn, pg_encoding_to_char(encoding) FROM pg_database WHERE datname = 'insightEd';")
        db_info = cur.fetchone()
        print(f"\nDatabase Info: {db_info}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_session_vars()
