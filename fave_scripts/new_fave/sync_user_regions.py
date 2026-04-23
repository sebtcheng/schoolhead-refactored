import os
import psycopg2
import argparse
from dotenv import load_dotenv

# Use the working connection string identified during research
load_dotenv('.env')
DATABASE_URL = os.getenv('DATABASE_URL_DIRECT', 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd')

def sync_regions(dry_run=True):
    print(f"--- {'[DRY RUN] ' if dry_run else ''}User Regional Mapping Sync Started ---")
    
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        cur = conn.cursor()
        
        # 1. Preview changes using a JOIN
        # We use a CTE to find matches by school_id then iern
        match_query = """
        WITH potential_matches AS (
            SELECT 
                u.uid, 
                u.email, 
                u.division, 
                u.school_id, 
                u.iern as user_iern,
                s."Region" as new_region,
                s."Division" as iern_division,
                ROW_NUMBER() OVER (PARTITION BY u.uid ORDER BY (CASE WHEN u.school_id = s."SchoolID" THEN 1 ELSE 2 END)) as rank
            FROM users u
            JOIN "schools_IERN" s ON (u.school_id = s."SchoolID" OR u.iern = s.iern)
            WHERE s.status = 'Active'
              AND (u.division IS NOT NULL AND u.division != '')
              AND (u.region IS NULL OR u.region = '')
        )
        SELECT email, division, new_region, iern_division, uid
        FROM potential_matches
        WHERE rank = 1;
        """
        
        cur.execute(match_query)
        matches = cur.fetchall()
        
        if not matches:
            print("✅ No users found matching schools_IERN criteria.")
            return

        print(f"Found {len(matches)} users to update.")
        
        print("\nPreview of proposed updates (top 20):")
        print(f"{'Email':<35} | {'Current Division':<25} | {'New Region':<20}")
        print("-" * 85)
        for email, old_div, new_reg, iern_div, uid in matches[:20]:
            print(f"{email:<35} | {old_div:<25} | {new_reg:<20}")
        
        if len(matches) > 20:
            print(f"... and {len(matches) - 20} more.")
            
        if not dry_run:
            print(f"\nApplying {len(matches)} updates...")
            
            # Use the same logic for the actual update
            update_query = """
            UPDATE users u
            SET region = subquery.new_region
            FROM (
                SELECT DISTINCT ON (u.uid)
                    u.uid,
                    s."Region" as new_region
                FROM users u
                JOIN "schools_IERN" s ON (u.school_id = s."SchoolID" OR u.iern = s.iern)
                WHERE s.status = 'Active'
                  AND (u.division IS NOT NULL AND u.division != '')
                  AND (u.region IS NULL OR u.region = '')
                ORDER BY u.uid, (CASE WHEN u.school_id = s."SchoolID" THEN 1 ELSE 2 END)
            ) as subquery
            WHERE u.uid = subquery.uid;
            """
            
            cur.execute(update_query)
            update_count = cur.rowcount
            conn.commit()
            print(f"✅ Successfully updated {update_count} users.")
        else:
            print("\n[DRY RUN] No changes were committed to the database.")

        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync missing region for users from schools_IERN.")
    parser.add_argument("--apply", action="store_true", help="Apply updates to the database (defaults to dry-run).")
    args = parser.parse_args()
    
    sync_regions(dry_run=not args.apply)
