import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT * FROM ph_migrations ORDER BY executed_at DESC LIMIT 20;")
    migrations = cur.fetchall()
    print("Recent migrations:")
    for m in migrations:
        print(m)
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
