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

def analyze_data():
    db_url = get_db_url()
    if not db_url:
        return

    try:
        conn = psycopg2.connect(db_url, sslmode='prefer')
        cur = conn.cursor()
        
        cols_to_check = [
            'project_name', ' project_name ',
            'scope_of_work', ' scope_of_work ',
            'number_of_classrooms', ' number_of_classrooms ',
            'contract_amount', ' contract_amount '
        ]
        
        print("Analyzing data counts for potentially duplicated columns in engineer_form:")
        for col in cols_to_check:
            cur.execute(f'SELECT COUNT("{col}") FROM engineer_form')
            count = cur.fetchone()[0]
            print(f' - Column |{col}|: {count} non-null records')
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    analyze_data()
