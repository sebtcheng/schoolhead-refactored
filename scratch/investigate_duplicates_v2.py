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

def investigate_all():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    # Get all users in the specific roles
    cur.execute("""
        SELECT uid, LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), email, role, created_at
        FROM users
        WHERE role IN ('Architect', 'Division Engineer')
    """)
    users = cur.fetchall()
    
    # Store mapped by name
    name_map = {}
    for uid, fname, lname, email, role, created_at in users:
        key = f"{fname}|{lname}"
        if key not in name_map:
            name_map[key] = []
        name_map[key].append({
            'uid': uid,
            'email': email,
            'role': role,
            'created_at': created_at,
            'name': f"{fname} {lname}"
        })

    duplicates = {k: v for k, v in name_map.items() if len(v) > 1}
    
    print(f"Total Duplicate Names Found: {len(duplicates)}")
    
    report = []
    
    for key, user_list in duplicates.items():
        user_data = []
        for u in user_list:
            uid = u['uid']
            # Check projects
            cur.execute("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = %s OR assigned_engineer_id = %s", (uid, uid))
            proj_count = cur.fetchone()[0]
            
            # Check updates (activity logs)
            cur.execute("SELECT COUNT(*) FROM activity_logs WHERE user_uid = %s AND action_type ILIKE '%%update%%'", (uid,))
            update_count = cur.fetchone()[0]
            
            u['projects'] = proj_count
            u['updates'] = update_count
            user_data.append(u)
            
        report.append(user_data)

    # Sort report: groups with projects first
    report.sort(key=lambda x: sum(u['projects'] + u['updates'] for u in x), reverse=True)

    for group in report[:20]: # Show top 20 for now
        print(f"\nGroup: {group[0]['name']}")
        for u in group:
            print(f"  UID: {u['uid']} | Email: {u['email']} | Created: {u['created_at']} | Projects: {u['projects']} | Updates: {u['updates']}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    investigate_all()
