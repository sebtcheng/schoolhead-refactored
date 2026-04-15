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

def check_entities():
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT target_entity FROM activity_logs")
    entities = cur.fetchall()
    print(f"Distinct Target Entities: {[e[0] for e in entities]}")
    
    cur.execute("SELECT DISTINCT action_type FROM activity_logs")
    actions = cur.fetchall()
    print(f"Distinct Action Types: {[a[0] for a in actions]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_entities()
