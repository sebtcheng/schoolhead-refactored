import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")

def extract_projects():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Query for projects created by engineers that require approval
        # Based on workflow docs, 'Pending' is the status for projects requiring approval.
        # We also filter for projects where an engineer is assigned or associated.
        query = """
            SELECT 
                project_id, 
                project_name, 
                school_name, 
                engineer_id, 
                engineer_name, 
                created_at, 
                division, 
                region,
                approval_status,
                uploader_type
            FROM engineer_form 
            WHERE approval_status = 'Pending'
            ORDER BY created_at DESC;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        colnames = [desc[0] for desc in cur.description]
        
        import csv
        with open('pending_projects.csv', 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(colnames)
            writer.writerows(rows)
            
        print(f"Found {len(rows)} projects requiring approval.")
        print("Results saved to pending_projects.csv")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_projects()
