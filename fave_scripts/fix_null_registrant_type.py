import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- Fixing NULL registrant_type for School Heads ---")
    query = """
        UPDATE users 
        SET registrant_type = 'School Head' 
        WHERE role = 'School Head' AND registrant_type IS NULL
    """
    cur.execute(query)
    count = cur.rowcount
    conn.commit()
    
    print(f"✅ Successfully updated {count} records.")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
