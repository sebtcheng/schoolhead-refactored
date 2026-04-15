import psycopg2
import os
import re

def get_db_url():
    env_path = '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return None

def normalize_name(name):
    if not name: return ""
    # Remove non-alphanumeric characters and normalize enye
    name = name.lower()
    name = name.replace('ñ', 'n')
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def normalize_email(email):
    if not email: return ""
    # Get the part before @ and handle the common deped issue
    base = email.split('@')[0].lower()
    # Remove '001', 'deped.gov.ph', etc. that often get appended
    base = base.replace('deped.gov.ph', '').replace('001', '').replace('.', '')
    return base

def find_hidden_duplicates():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT uid, first_name, last_name, email, role, created_at, region, division
        FROM users
        WHERE role IN ('Architect', 'Division Engineer')
    """)
    users = cur.fetchall()
    
    # 1. Group by Normalized Name
    name_groups = {}
    for u in users:
        uid, fname, lname, email, role, created_at, region, division = u
        norm_name = normalize_name(fname) + normalize_name(lname)
        if norm_name not in name_groups:
            name_groups[norm_name] = []
        name_groups[norm_name].append(u)

    print("POTENTIAL DUPLICATES BY NORMALIZED NAME:")
    for name, group in name_groups.items():
        if len(group) > 1:
            print(f"\nGroup: {name}")
            for u in group:
                print(f"  UID: {u[0]} | Name: {u[1]} {u[2]} | Email: {u[3]} | Created: {u[5]}")

    # 2. Group by Normalized Email Prefix
    email_groups = {}
    for u in users:
        uid, fname, lname, email, role, created_at, region, division = u
        norm_email = normalize_email(email)
        if norm_email not in email_groups:
            email_groups[norm_email] = []
        email_groups[norm_email].append(u)

    print("\n" + "="*80)
    print("POTENTIAL DUPLICATES BY NORMALIZED EMAIL PREFIX:")
    for email, group in email_groups.items():
        if len(group) > 1:
            # Only show if not already found by name or if names are different
            print(f"\nGroup: {email}")
            for u in group:
                print(f"  UID: {u[0]} | Name: {u[1]} {u[2]} | Email: {u[3]} | Created: {u[5]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    find_hidden_duplicates()
