import psycopg2
import os
import re

def get_db_url():
    """Manually parse .env file to get DATABASE_URL since python-dotenv is not installed."""
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at {env_path}")
    
    with open(env_path, 'r') as f:
        content = f.read()
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', content)
        if match:
            return match.group(1).strip()
    return None

def find_duplicates():
    db_url = get_db_url()
    if not db_url:
        print("❌ Error: DATABASE_URL not found in .env")
        return

    try:
        # Connect to DB
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()

        # 1. Get all column names
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form' 
            ORDER BY ordinal_position
        """)
        all_columns = [row[0] for row in cur.fetchall()]

        # 2. Exclude the 3 columns specified by the user
        exclude_cols = {'project_id', 'ipc', 'created_at'}
        compare_cols = [col for col in all_columns if col not in exclude_cols]

        print(f"Analyzing duplicates based on {len(compare_cols)} matching columns...")
        print(f"Columns ignored: {', '.join(exclude_cols)}")

        # 3. Construct the duplicate check query
        # We group by all compare_cols and find groups with count > 1
        cols_str = ", ".join([f'"{col}"' for col in compare_cols])
        
        query = f"""
            SELECT {cols_str}, COUNT(*) as dup_count, ARRAY_AGG(project_id) as project_ids
            FROM engineer_form
            GROUP BY {cols_str}
            HAVING COUNT(*) > 1
            ORDER BY dup_count DESC;
        """

        cur.execute(query)
        duplicates = cur.fetchall()

        if not duplicates:
            print("\nNo duplicate projects found based on your criteria!")
        else:
            print(f"\nFound {len(duplicates)} groups of duplicate projects:\n")
            print("-" * 50)
            
            for idx, row in enumerate(duplicates, 1):
                dup_count = row[-2]
                proj_ids = row[-1]
                
                # Fetch project name for display (assuming project_name is in columns)
                proj_name = "Unknown"
                if 'project_name' in compare_cols:
                    proj_name_idx = compare_cols.index('project_name')
                    proj_name = row[proj_name_idx]

                print(f"{idx}. Project: {proj_name}")
                print(f"   Count: {dup_count} duplicates")
                print(f"   Project IDs involved: {', '.join(map(str, proj_ids))}")
                print("-" * 50)

    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    find_duplicates()
