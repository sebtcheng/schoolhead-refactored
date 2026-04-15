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

def find_details():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Get duplicates by name
    cur.execute("""
        SELECT LOWER(TRIM(first_name)) as fname, LOWER(TRIM(last_name)) as lname, COUNT(*)
        FROM users
        WHERE role IN ('Architect', 'Division Engineer')
        GROUP BY fname, lname
        HAVING COUNT(*) > 1
    """)
    dups = cur.fetchall()
    
    for fname, lname, count in dups:
        print(f"\nDuplicate Name: {fname} {lname}")
        cur.execute("""
            SELECT uid, email, created_at
            FROM users
            WHERE LOWER(TRIM(first_name)) = %s AND LOWER(TRIM(last_name)) = %s
        """, (fname, lname))
        details = cur.fetchall()
        for uid, email, created_at in details:
            print(f"  UID: {uid} | Email: {email} | Created: {created_at}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    find_details()
