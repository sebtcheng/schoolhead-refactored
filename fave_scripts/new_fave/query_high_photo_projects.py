import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback in case .env loading fails or DATABASE_URL is missing
if not DATABASE_URL:
    DATABASE_URL = "postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd"

def query_high_photo_projects():
    """
    Connects to the database and identifies projects with high photo counts, 
    including engineer names, school information, region, and division.
    """
    conn = None
    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("\n" + "="*165)
        print("                                PROJECTS WITH HIGH PHOTO COUNTS, ENGINEER NAMES, SCHOOL INFO, REGION, AND DIVISION")
        print("="*165)

        query = """
            SELECT 
                ef.project_name,
                COALESCE(ef.engineer_name, ef.assigned_engineer_name, 'N/A') as engineer,
                ef.region,
                ef.division,
                ef.school_id,
                ef.school_name,
                COUNT(ei.id) as photo_count
            FROM engineer_form ef
            LEFT JOIN engineer_image ei ON ef.project_id = ei.project_id
            WHERE (ef.engineer_name IS NOT NULL AND ef.engineer_name != '')
               OR (ef.assigned_engineer_name IS NOT NULL AND ef.assigned_engineer_name != '')
            GROUP BY ef.project_name, ef.engineer_name, ef.assigned_engineer_name, ef.region, ef.division, ef.school_id, ef.school_name
            HAVING COUNT(ei.id) > 0
            ORDER BY photo_count DESC
            LIMIT 25;
        """

        cur.execute(query)
        rows = cur.fetchall()

        if not rows:
            print("\n[INFO]: No projects found with photos and engineer names indicated.")
        else:
            print("\n" + "-" * 165)
            print(f"{'Project Name':<35} | {'Engineer':<20} | {'Region':<12} | {'Division':<25} | {'School ID':<10} | {'School Name':<30} | {'Photos':>6}")
            print("-" * 165)
            
            for name, engr, region, division, sid, sname, count in rows:
                p_name = (name[:32] + '...') if name and len(name) > 35 else (name or "N/A")
                p_engr = (engr[:17] + '...') if engr and len(engr) > 20 else engr
                p_region = region or "N/A"
                p_division = (division[:22] + '...') if division and len(division) > 25 else (division or "N/A")
                p_sname = (sname[:27] + '...') if sname and len(sname) > 30 else (sname or "N/A")
                p_sid = sid or "N/A"
                print(f"{p_name:<35} | {p_engr:<20} | {p_region:<12} | {p_division:<25} | {p_sid:<10} | {p_sname:<30} | {count:>6}")

            print("-" * 165)
            print(f"\n[TOTAL RESULTS]: {len(rows)}")

        cur.close()
    except Exception as e:
        print(f"\n[ERROR]: Failed to query projects.")
        print(f"Details: {e}")
    finally:
        if conn:
            conn.close()
            print("\nDatabase connection closed.")

if __name__ == "__main__":
    query_high_photo_projects()
