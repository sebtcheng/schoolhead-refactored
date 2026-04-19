import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
# Based on the project structure, .env is in the root directory
load_dotenv(os.path.join(os.getcwd(), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback in case .env loading fails or DATABASE_URL is missing
if not DATABASE_URL:
    DATABASE_URL = "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd"

def check_projects():
    """
    Connects to the database and prints total projects and counts per category.
    """
    conn = None
    try:
        # Use simple connection string
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("\n" + "="*50)
        print("      ENGINEER_FORM UNIQUE IPC ANALYSIS")
        print("="*50)

        # 1. Get Total Unique IPCs
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form")
        total_projects = cur.fetchone()[0]
        print(f"\n[TOTAL UNIQUE PROJECTS (IPC)]: {total_projects}")

        # 2. Get Unique IPCs per Category
        print("\n[PROJECTS PER CATEGORY]:")
        print("-" * 50)
        print(f"{'Category Name':<35} | {'Count':>10}")
        print("-" * 50)
        
        cur.execute("""
            SELECT project_category, COUNT(DISTINCT ipc) 
            FROM engineer_form 
            GROUP BY project_category 
            ORDER BY COUNT(DISTINCT ipc) DESC
        """)
        categories = cur.fetchall()

        for cat, count in categories:
            category_name = cat if cat else "Uncategorized"
            # Truncate long category names for display
            display_name = (category_name[:32] + '...') if len(category_name) > 35 else category_name
            print(f"{display_name:<35} | {count:>10}")

        print("-" * 50)
        
        cur.close()
    except Exception as e:
        print(f"\n[ERROR]: Failed to analyze projects.")
        print(f"Details: {e}")
    finally:
        if conn:
            conn.close()
            print("\nDatabase connection closed.")

if __name__ == "__main__":
    check_projects()
