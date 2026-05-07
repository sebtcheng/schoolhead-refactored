import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check if it's a table
    cur.execute("""
        SELECT table_type 
        FROM information_schema.tables 
        WHERE table_name = 'ph_schools_audit'
    """)
    res = cur.fetchone()
    if res:
        print(f"ph_schools_audit type: {res[0]}")
    else:
        print("ph_schools_audit not found in tables/views.")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
