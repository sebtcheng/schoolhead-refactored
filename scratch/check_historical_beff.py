import psycopg2
import os
import re

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        return None
    with open(env_path, 'r', encoding='utf-8') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def check_historical():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        print("Checking for projects with School 304738 and Year 2016 in BEFF:")
        cur.execute("SELECT school_id, funding_year, approved_budget_for_contract, ipc FROM import_beff_projects WHERE school_id::text = '304738' AND funding_year = 2016")
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"BEFF: {r}")
        else:
            print("No records found for School 304722, Year 2015.")
            
        print("\nChecking for ANY 2015 projects in BEFF:")
        cur.execute("SELECT COUNT(*) FROM import_beff_projects WHERE funding_year = 2015")
        count = cur.fetchone()[0]
        print(f"Total 2015 projects in BEFF: {count}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_historical()
