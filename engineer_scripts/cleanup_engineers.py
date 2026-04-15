import os
import psycopg2
import sys
import datetime
import csv
import re

def get_db_url():
    """Reads the DATABASE_URL from the .env file in the root directory."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return None

def normalize_name(fname, lname):
    """Normalizes name by removing spaces, dots, and converting enye to n."""
    full = f"{str(fname or '')}{str(lname or '')}".lower()
    full = full.replace('ñ', 'n')
    full = re.sub(r'[^a-z0-9]', '', full)
    return full

def normalize_email_prefix(email):
    """Normalize email prefix by removing dots, numbers and deped artifacts."""
    if not email: return ""
    prefix = email.split('@')[0].lower()
    # Remove common registration artifacts
    prefix = prefix.replace('deped.gov.ph', '').replace('001', '').replace('.', '')
    return prefix

def check_activity(cur, uid):
    """Checks if a UID has any activity in engineer-related tables."""
    activity = {}
    
    # 1. engineer_form
    cur.execute("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = %s OR assigned_engineer_id = %s", (uid, uid))
    activity['projects'] = cur.fetchone()[0]
    
    # 2. engineer_image
    cur.execute("SELECT COUNT(*) FROM engineer_image WHERE uploaded_by = %s", (uid,))
    activity['images'] = cur.fetchone()[0]
    
    # 3. engineer_documents
    cur.execute("SELECT COUNT(*) FROM engineer_documents WHERE uploader_id = %s", (uid,))
    activity['documents'] = cur.fetchone()[0]
    
    # 4. activity_logs (Only count project-related actions)
    cur.execute("""
        SELECT COUNT(*) FROM activity_logs 
        WHERE user_uid = %s 
        AND (target_entity = 'Project' OR action_type IN ('CREATE', 'DELETE'))
        AND action_type != 'REGISTER'
    """, (uid,))
    activity['logs'] = cur.fetchone()[0]
    
    total = sum(activity.values())
    return total, activity

def main():
    apply_mode = "--apply" in sys.argv
    db_url = get_db_url()
    
    if not db_url:
        print("Error: DATABASE_URL not found in .env")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("-" * 60)
    print(f"FUZZY ENGINEER DUPLICATE CLEANUP | MODE: {'APPLY' if apply_mode else 'DRY RUN'}")
    print("-" * 60)

    # 1. Fetch all Division Engineers and Architects
    cur.execute("""
        SELECT uid, first_name, last_name, email, role, created_at, contact_number, region, division
        FROM users
        WHERE role IN ('Architect', 'Division Engineer')
    """)
    users = cur.fetchall()
    
    user_objects = []
    for u in users:
        uid, fname, lname, email, role, created_at, contact, region, division = u
        user_objects.append({
            'uid': uid,
            'first_name': fname,
            'last_name': lname,
            'email': email,
            'role': role,
            'created_at': created_at,
            'contact': contact,
            'region': region,
            'division': division,
            'norm_name': normalize_name(fname, lname),
            'norm_email': normalize_email_prefix(email)
        })

    # 2. Advanced Grouping (Normalized Name OR Normalized Email)
    groups = []
    processed_uids = set()

    for u in user_objects:
        if u['uid'] in processed_uids:
            continue
            
        # Find all associated accounts in this cluster
        cluster = [u]
        processed_uids.add(u['uid'])
        
        # Grow the cluster
        found_new = True
        while found_new:
            found_new = False
            cluster_norm_names = {c['norm_name'] for c in cluster}
            cluster_norm_emails = {c['norm_email'] for c in cluster}
            
            for other in user_objects:
                if other['uid'] not in processed_uids:
                    if other['norm_name'] in cluster_norm_names or other['norm_email'] in cluster_norm_emails:
                        cluster.append(other)
                        processed_uids.add(other['uid'])
                        found_new = True
        
        if len(cluster) > 1:
            groups.append(cluster)

    # 3. Analyze duplicates within groups
    to_delete = []
    to_keep = []
    conflicts = []
    
    for cluster in groups:
        active_users = []
        inactive_users = []
        
        for u in cluster:
            total_activity, details = check_activity(cur, u['uid'])
            u['activity_total'] = total_activity
            u['activity_details'] = details
            u['is_malformed_email'] = "deped.gov.ph@deped.gov.ph" in (u['email'] or "").lower() or "deped.hov.ph@deped.gov.ph" in (u['email'] or "").lower()
            
            if total_activity > 0:
                active_users.append(u)
            else:
                inactive_users.append(u)

        # Decision Logic
        if len(active_users) > 1:
            conflicts.append(cluster)
        elif len(active_users) == 1:
            to_keep.append(active_users[0])
            to_delete.extend(inactive_users)
        else:
            # NONE ACTIVE: Keep the latest one with the cleanest email
            cluster.sort(key=lambda x: (not x['is_malformed_email'], x['created_at']), reverse=True)
            to_keep.append(cluster[0])
            to_delete.extend(cluster[1:])

    # 4. Report Findings
    print(f"Total Clusters Found: {len(groups)}")
    print(f"Users identified as redundant: {len(to_delete)}")
    print(f"Accounts to retain: {len(to_keep)}")
    print(f"Conflicts (manual review): {len(conflicts)}")
    print("-" * 60)

    # 5. Generate Reports (Always generated in Dry Run)
    report_file = "proposed_deletions_fuzzy.csv"
    with open(report_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Status', 'Name', 'Email', 'Activity', 'UID', 'Created At', 'Role', 'Region', 'Division'])
        
        for u in to_delete:
            writer.writerow(['DELETE', f"{u['first_name']} {u['last_name']}", u['email'], u['activity_total'], u['uid'], u['created_at'], u['role'], u['region'], u['division']])
        for u in to_keep:
            writer.writerow(['RETAIN', f"{u['first_name']} {u['last_name']}", u['email'], u['activity_total'], u['uid'], u['created_at'], u['role'], u['region'], u['division']])

    print(f"\nDETAILED AUDIT CSV GENERATED: {report_file}")

    if conflicts:
        conflict_file = "engineer_cleanup_conflicts_fuzzy.csv"
        with open(conflict_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Name', 'UID', 'Email', 'Role', 'Created At', 'Activity Count'])
            for cluster in conflicts:
                for u in cluster:
                    writer.writerow([f"{u['first_name']} {u['last_name']}", u['uid'], u['email'], u['role'], u['created_at'], u['activity_total']])
        print(f"CONFLICT REPORT GENERATED: {conflict_file}")

    # 6. Apply Phase (Locked behind flag)
    if apply_mode and to_delete:
        log_file = f"cleanup_fuzzy_log_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(log_file, 'w', encoding='utf-8') as log:
            log.write(f"FUZZY CLEANUP LOG - {datetime.datetime.now()}\n")
            log.write("-" * 50 + "\n")
            for u in to_delete:
                try:
                    cur.execute("DELETE FROM users WHERE uid = %s", (u['uid'],))
                    log.write(f"DELETED: {u['uid']} | {u['first_name']} {u['last_name']} | {u['email']}\n")
                except Exception as e:
                    log.write(f"ERROR: {u['uid']} | {e}\n")
        conn.commit()
        print(f"\nCleanup execution complete. Log: {log_file}")
    elif to_delete:
        print("\nACTION REQUIRED: Review 'proposed_deletions_fuzzy.csv' above.")
        print("Run with --apply ONLY after you have verified the list.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
