import psycopg2
import json

def get_schema(table_name):
    try:
        conn = psycopg2.connect("dbname='insighted_db' user='postgres' host='localhost'")
        cur = conn.cursor()
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
        columns = cur.fetchall()
        print(f"Columns for {table_name}:")
        for col in columns:
            print(f" - {col[0]} ({col[1]})")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error getting schema for {table_name}: {e}")

if __name__ == "__main__":
    get_schema('pending_schools')
    get_schema('schools_IERN')
