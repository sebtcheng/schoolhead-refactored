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

def find_patterns():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Broad search for suspected email patterns
    cur.execute("""
        SELECT email 
        FROM users 
        WHERE email LIKE '%%deped.gov.ph%%@deped.gov.ph'
    """)
    emails = [e[0] for e in cur.fetchall()]
    print(f"Suspect emails: {emails}")

    # Also check for same name but different UID
    cur.execute("""
        SELECT LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), COUNT(*)
        FROM users
        WHERE role IN ('Architect', 'Division Engineer')
        GROUP BY LOWER(TRIM(first_name)), LOWER(TRIM(last_name))
        HAVING COUNT(*) > 1
    """)
    dups = cur.fetchall()
    print(f"\nName duplicates count: {len(dups)}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    find_patterns()
