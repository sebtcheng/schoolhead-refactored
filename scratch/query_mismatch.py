import psycopg2
import json

def run_query():
    db_url = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Total conversions in pending_schools
        cur.execute("SELECT count(*) FROM pending_schools WHERE registration_type = 'conversion'")
        total_conversions = cur.fetchone()[0]
        
        # 2. Mismatched school_ids
        # Using "SchoolID" for schools_IERN as seen in previous output
        query = """
        SELECT count(*) 
        FROM pending_schools ps
        WHERE ps.registration_type = 'conversion'
        AND ps.school_id NOT IN (
            SELECT "SchoolID" FROM "schools_IERN" WHERE "SchoolID" IS NOT NULL
        )
        """
        cur.execute(query)
        mismatch_count = cur.fetchone()[0]
        
        # 3. List some mismatches for verification
        query_list = """
        SELECT ps.school_id, ps.school_name
        FROM pending_schools ps
        WHERE ps.registration_type = 'conversion'
        AND ps.school_id NOT IN (
            SELECT "SchoolID" FROM "schools_IERN" WHERE "SchoolID" IS NOT NULL
        )
        LIMIT 10
        """
        cur.execute(query_list)
        mismatches = cur.fetchall()
        
        print(f"Total 'conversion' in pending_schools: {total_conversions}")
        print(f"Number of those NOT in schools_IERN: {mismatch_count}")
        
        if mismatches:
            print("\nSample mismatches (school_id, school_name):")
            for m in mismatches:
                print(f" - {m[0]}: {m[1]}")
        else:
            print("\nNo mismatches found.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_query()
