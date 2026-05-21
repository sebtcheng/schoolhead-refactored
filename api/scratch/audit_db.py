import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"

def audit():
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        print("--- TRIGGER AUDIT ---")
        cur.execute("""
            SELECT tgname, relname 
            FROM pg_trigger 
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
            WHERE NOT tgisinternal;
        """)
        rows = cur.fetchall()
        for row in rows:
            print(f"Trigger: {row[0]:<30} | Table: {row[1]}")

        print("\n--- EVENT TRIGGER AUDIT (Schema Drift Protection) ---")
        cur.execute("SELECT evtname, evtevent, evtowner::regrole::text FROM pg_event_trigger;")
        rows = cur.fetchall()
        for row in rows:
            print(f"Event Trigger: {row[0]:<20} | Event: {row[1]:<15} | Owner: {row[2]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit()
