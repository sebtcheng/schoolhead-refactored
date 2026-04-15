import psycopg2
import os

def get_db_url():
    env_path = '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return None

def find_engineer_tables():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # List all tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    tables = [t[0] for t in cur.fetchall()]
    
    engineer_tables = [t for t in tables if 'engineer' in t.lower()]
    print(f"Tables with 'engineer' in name: {engineer_tables}")

    # For each engineer table, check columns that might be UIDs
    for table in engineer_tables:
        cur.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{table}'
        """)
        cols = cur.fetchall()
        print(f"Table: {table} | Columns: {[c[0] for c in cols]}")

    # Check for email pattern
    cur.execute("""
        SELECT email, COUNT(*) 
        FROM users 
        WHERE email LIKE '%%@deped.gov.ph@deped.gov.ph'
        GROUP BY email
    """)
    email_patterns = cur.fetchall()
    print(f"\nUsers with double domain emails: {email_patterns}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    find_engineer_tables()
