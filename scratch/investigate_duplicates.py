import psycopg2
import os
from urllib.parse import urlparse

def get_db_url():
    env_path = '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return None

def investigate():
    db_url = get_db_url()
    if not db_url:
        print("DATABASE_URL not found")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Find users with same first_name and last_name (case-insensitive) but different UIDs
    query = """
    SELECT LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), COUNT(*)
    FROM users
    WHERE role IN ('Architect', 'Division Engineer')
    GROUP BY LOWER(TRIM(first_name)), LOWER(TRIM(last_name))
    HAVING COUNT(*) > 1;
    """
    
    cur.execute(query)
    duplicates = cur.fetchall()

    print(f"Found {len(duplicates)} name-based duplicate pairs.")
    
    for fname, lname, count in duplicates:
        print(f"\nPotential Duplicate: {fname} {lname} ({count} accounts)")
        
        # Get details for these users
        cur.execute("""
            SELECT uid, email, contact_number, created_at, role
            FROM users
            WHERE LOWER(TRIM(first_name)) = %s AND LOWER(TRIM(last_name)) = %s
            ORDER BY created_at DESC
        """, (fname, lname))
        
        user_rows = cur.fetchall()
        for idx, urow in enumerate(user_rows):
            uid, email, contact_number, created_at, role = urow
            
            # Check for project updates/creation in engineer_form
            # Reference: engineer_id or possibly validated_by?
            # Let's check engineer_id first
            cur.execute("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = %s OR assigned_engineer_id = %s", (uid, uid))
            form_count = cur.fetchone()[0]
            
            # Also check activity_logs
            cur.execute("SELECT COUNT(*) FROM activity_logs WHERE user_uid = %s", (uid,))
            log_count = cur.fetchone()[0]
            
            print(f"  [{idx}] UID: {uid} | Email: {email} | Reg Date: {created_at} | Projects: {form_count} | Logs: {log_count}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    investigate()
