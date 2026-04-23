import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or "postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd"

def select_top_schools_region_vi():
    """
    Selects 5 schools in Region VI that satisfy:
    1. 100% total completion in ph_school_completion.
    2. Attached site ownership in school_ownership_docs.
    3. Assigned buildable space in ph_school_buildable_spaces.
    """
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("\n" + "="*120)
        print("                                SELECTING 5 SCHOOLS IN REGION VI (100% COMPLETION + SITE OWNERSHIP + BUILDABLE SPACE)")
        print("="*120)

        query = """
            SELECT 
                s.school_id, 
                s.school_name, 
                s.region,
                c.total_completion
            FROM ph_schools s
            JOIN ph_school_completion c ON s.iern = c.iern
            WHERE s.region = 'REGION VI'
              AND c.total_completion = 100
              AND EXISTS (SELECT 1 FROM school_ownership_docs o WHERE o.iern = s.iern)
              AND EXISTS (SELECT 1 FROM ph_school_buildable_spaces b WHERE b.iern = s.iern)
            LIMIT 5;
        """

        cur.execute(query)
        rows = cur.fetchall()

        if not rows:
            print("\n[INFO]: No schools found matching all criteria in Region VI.")
            # Fallback check if region name is slightly different
            cur.execute("SELECT DISTINCT region FROM ph_schools WHERE region ILIKE '%REGION VI%' LIMIT 5;")
            regions = cur.fetchall()
            if regions:
                print(f"[DEBUG]: Available regions matching 'REGION VI': {[r[0] for r in regions]}")
        else:
            print("\n" + "-" * 115)
            print(f"{'School ID':<12} | {'School Name':<60} | {'Region':<15} | {'Completion':>10}")
            print("-" * 115)
            
            for sid, sname, region, completion in rows:
                p_sname = (sname[:57] + '...') if sname and len(sname) > 60 else (sname or "N/A")
                print(f"{sid:<12} | {p_sname:<60} | {region:<15} | {completion:>9}%")

            print("-" * 115)
            print(f"\n[TOTAL RESULTS]: {len(rows)}")

        cur.close()
    except Exception as e:
        print(f"\n[ERROR]: Failed to query schools.")
        print(f"Details: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    select_top_schools_region_vi()
