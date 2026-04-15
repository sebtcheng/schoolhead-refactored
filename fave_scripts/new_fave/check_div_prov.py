import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(r'e:\InsightED April 2026\InsightEd-Mobile-PWA-2026\.env')
database_url = os.getenv('DATABASE_URL')

try:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()
    
    # Check if any division spans multiple provinces
    cur.execute("""
        SELECT division, COUNT(DISTINCT province) as p_count
        FROM all_locations
        WHERE division IS NOT NULL AND province IS NOT NULL
        GROUP BY division
        HAVING COUNT(DISTINCT province) > 1
    """)
    results = cur.fetchall()
    if results:
        print("Divisions spanning multiple provinces:")
        for r in results:
            print(f"  {r[0]}: {r[1]} provinces")
    else:
        print("All divisions map to exactly one province.")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
