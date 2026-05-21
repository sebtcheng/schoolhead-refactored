import psycopg2
import json

def list_tables():
    db_url = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Check specific tables
        tables_to_check = ['pending_schools', 'schools_IERN']
        for table_name in tables_to_check:
            print(f"\n--- Checking table: {table_name} ---")
            cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
            columns = cur.fetchall()
            if columns:
                print(f"Columns for {table_name}:")
                for col in columns:
                    print(f" - {col[0]} ({col[1]})")
            else:
                print(f"Table {table_name} not found in information_schema.columns")

        # Get registration types from pending_schools
        print("\n--- Distinct registration types in pending_schools ---")
        cur.execute("SELECT DISTINCT registration_type FROM pending_schools")
        types = cur.fetchall()
        for t in types:
            print(f" - {t[0]}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_tables()
