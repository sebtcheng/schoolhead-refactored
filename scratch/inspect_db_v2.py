import psycopg2
import json

def list_tables():
    try:
        # Using the port from api/index.js
        conn = psycopg2.connect("dbname='insightEd' user='Administrator1' password='pRZTbQ2T1JD7' host='127.0.0.1' port='6432'")
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        print("Tables in public schema:")
        for table in tables:
            print(f" - {table[0]}")
        
        # Check specific tables
        for table_name in ['pending_schools', 'schools_IERN']:
            cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
            columns = cur.fetchall()
            if columns:
                print(f"\nColumns for {table_name}:")
                for col in columns:
                    print(f" - {col[0]} ({col[1]})")
            else:
                # Try with quotes just in case
                cur.execute(f'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = "{table_name}"')
                columns = cur.fetchall()
                if columns:
                    print(f"\nColumns for {table_name} (with quotes):")
                    for col in columns:
                        print(f" - {col[0]} ({col[1]})")
                else:
                    print(f"\nTable {table_name} not found in information_schema.columns")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_tables()
