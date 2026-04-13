import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def populate_regions():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    conn = None
    try:
        conn = psycopg2.connect(database_url, sslmode='require')
        conn.autocommit = False # Use transaction
        cur = conn.cursor()

        print("--- Region Population Step ---")

        # 1. Fetch Mapping from all_locations
        cur.execute("SELECT DISTINCT division, region FROM all_locations WHERE division IS NOT NULL AND region IS NOT NULL")
        mapping_rows = cur.fetchall()
        
        # Build mapping dictionary, handling the "LAS PI?AS" issue
        division_to_region = {}
        for div, reg in mapping_rows:
            # Clean division names if they contain the broken character
            clean_div = div.replace('?AS', 'ÑAS').replace('?AS', 'ÑAS') # Handling common misencodings
            division_to_region[clean_div.upper().strip()] = reg.upper().strip()

        # Add manual mapping for LAS PIÑAS if missing or slightly different
        division_to_region['LAS PIÑAS CITY'] = 'NCR'
        division_to_region['LAS PINAS CITY'] = 'NCR'

        print(f"✅ Loaded {len(division_to_region)} unique division -> region mappings.")

        # 2. Identify users with NULL or empty regions
        cur.execute("SELECT uid, division FROM users WHERE region IS NULL OR region = '' OR region = 'NULL'")
        users_to_update = cur.fetchall()
        
        if not users_to_update:
            print("✨ No users found with missing regions.")
            return

        print(f"🔍 Found {len(users_to_update)} users to process.")

        updated_count = 0
        skipped_count = 0
        missing_mapping = set()

        # 3. Perform Updates
        for user_uid, division in users_to_update:
            if not division:
                skipped_count += 1
                continue
                
            div_key = division.upper().strip()
            region = division_to_region.get(div_key)

            if region:
                cur.execute("UPDATE users SET region = %s WHERE uid = %s", (region, user_uid))
                updated_count += 1
            else:
                skipped_count += 1
                missing_mapping.add(div_key)

        # Commit changes
        conn.commit()
        print(f"🚀 Successfully updated {updated_count} users.")
        print(f"ℹ️ Skipped {skipped_count} users (no mapping or no division).")
        
        if missing_mapping:
            print(f"⚠️ Divisions missing mapping: {missing_mapping}")

        # Final check
        cur.execute("SELECT count(*) FROM users WHERE region IS NULL OR region = ''")
        remaining = cur.fetchone()[0]
        print(f"📊 Final count of users with NULL region: {remaining}")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"❌ Error during update: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    populate_regions()
