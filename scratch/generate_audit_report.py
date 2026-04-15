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

def generate_full_report():
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
    
    report_md = "# Duplicate User Audit Report\n\n"
    report_md += "Below is the list of duplicate Division Engineer and Architect accounts identified for manual verification.\n\n"
    
    for fname, lname, count in dups:
        report_md += f"## {fname.title()} {lname.title()}\n"
        report_md += "| UID | Email | Registered At | Activity |\n"
        report_md += "| :--- | :--- | :--- | :--- |\n"
        
        cur.execute("""
            SELECT uid, email, created_at, role
            FROM users
            WHERE LOWER(TRIM(first_name)) = %s AND LOWER(TRIM(last_name)) = %s
            ORDER BY created_at DESC
        """, (fname, lname))
        
        details = cur.fetchall()
        for uid, email, created_at, role in details:
            # Quick activity check
            cur.execute("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = %s OR assigned_engineer_id = %s", (uid, uid))
            p_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM activity_logs WHERE user_uid = %s AND target_entity = 'Project'", (uid,))
            l_count = cur.fetchone()[0]
            
            activity_str = f"{p_count} Projects, {l_count} Project Logs"
            report_md += f"| `{uid}` | `{email}` | {str(created_at)[:19]} | {activity_str} |\n"
        report_md += "\n"

    # Write to artifact directory (Brain)
    artifact_path = r"C:\Users\KleinZebastianCatapa\.gemini\antigravity\brain\eed9c54a-956d-4ed3-9aa4-80f7c08dc557\duplicate_audit_report.md"
    with open(artifact_path, "w") as f:
        f.write(report_md)
    
    print(f"Report generated: {artifact_path}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    generate_full_report()
