import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

def check_locks_detail():
    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                pid, 
                state, 
                query, 
                query_start, 
                now() - query_start AS duration
            FROM pg_stat_activity 
            WHERE state != 'idle' 
              AND query NOT LIKE '%pg_stat_activity%'
            ORDER BY duration DESC;
        """)
        rows = cur.fetchall()
        print(f"Active non-idle processes: {len(rows)}")
        for row in rows:
            print(f"PID: {row[0]}, State: {row[1]}, Duration: {row[4]}")
            print(f"Query: {row[2][:200]}...")
            print("-" * 40)

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_locks_detail()
