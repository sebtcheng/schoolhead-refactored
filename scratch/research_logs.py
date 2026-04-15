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

def check_log_types():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    uids = ['51c85b6f-a2cf-4e65-bff5-bec7a992ab03', '15ddb3e1-fa2e-4e65-ae35-ad195eab576b', '2e53032e-710f-4213-b9d9-b2e04b8fa043']
    
    for uid in uids:
        cur.execute("SELECT action_type, details FROM activity_logs WHERE user_uid = %s", (uid,))
        logs = cur.fetchall()
        print(f"\nLogs for {uid}:")
        for log in logs:
            print(f"  Action: {log[0]} | Details: {log[1][:50]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_log_types()
