import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check schema
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'ph_schools_audit'
        ORDER BY ordinal_position;
    """)
    columns = cur.fetchall()
    print("Schema for ph_schools_audit:")
    for col in columns:
        print(f"- {col[0]}: {col[1]}")
    
    # Check row count
    cur.execute("SELECT count(*) FROM ph_schools_audit;")
    count = cur.fetchone()[0]
    print(f"\nRow count: {count}")
    
    # Sample data
    if count > 0:
        cur.execute("SELECT * FROM ph_schools_audit LIMIT 1;")
        sample = cur.fetchone()
        print(f"\nSample row: {sample}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
