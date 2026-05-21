import psycopg2

def get_all_columns(table_name):
    db_url = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}' ORDER BY ordinal_position")
        columns = cur.fetchall()
        print(f"All columns for {table_name}:")
        for col in columns:
            print(f" - {col[0]}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_all_columns('pending_schools')
