import psycopg2

def check_constraints():
    db_url = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("--- Constraints for schools_IERN ---")
        cur.execute("""
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_class t ON c.conrelid = t.oid 
            WHERE t.relname = 'schools_IERN'
        """)
        for con in cur.fetchall():
            print(f" - {con[0]}: {con[1]}")
            
        print("\n--- Indexes for schools_IERN ---")
        cur.execute("""
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'schools_IERN'
        """)
        for idx in cur.fetchall():
            print(f" - {idx[0]}: {idx[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_constraints()
