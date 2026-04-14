import os
import psycopg2
from dotenv import load_dotenv
import sys

# Load environment variables from .env file in the parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_selection(options, prompt_text):
    """Helper to display a numbered list and get a valid selection."""
    print(f"\n{prompt_text}")
    for i, opt in enumerate(options, 1):
        print(f"  [{i}] {opt}")
    
    while True:
        try:
            choice = input(f"Select an option (1-{len(options)}) [or 'q' to quit]: ").strip().lower()
            if choice == 'q':
                return None
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
            else:
                print(f"Invalid selection. Please choose 1-{len(options)}.")
        except ValueError:
            print("Please enter a number.")

if __name__ == "__main__":
    print("--- Add Legislative District to Database (all_locations) ---")

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("Error: DATABASE_URL not found in .env file.")
        sys.exit(1)

    # HARDENED: single connection for the entire workflow, explicit commit/rollback
    conn = None
    try:
        conn = psycopg2.connect(database_url, sslmode='require')
        conn.autocommit = False
        cur = conn.cursor()

        # 1. Select Region
        cur.execute("SELECT DISTINCT region FROM all_locations WHERE region IS NOT NULL ORDER BY region")
        regions = [r[0] for r in cur.fetchall()]
        if not regions:
            print("No regions found in 'all_locations'.")
            sys.exit(1)

        selected_region = get_selection(regions, "Select a Region:")
        if not selected_region:
            print("Operation cancelled.")
            sys.exit(0)

        # 2. Select Division
        cur.execute("""
            SELECT DISTINCT division 
            FROM all_locations 
            WHERE region = %s AND division IS NOT NULL 
            ORDER BY division
        """, (selected_region,))
        divisions = [d[0] for d in cur.fetchall()]
        if not divisions:
            print(f"No divisions found for region {selected_region}.")
            sys.exit(1)

        selected_division = get_selection(divisions, f"Select a Division in {selected_region}:")
        if not selected_division:
            print("Operation cancelled.")
            sys.exit(0)

        # 3. Select Province
        cur.execute("""
            SELECT DISTINCT province 
            FROM all_locations 
            WHERE region = %s AND division = %s AND province IS NOT NULL 
            ORDER BY province
        """, (selected_region, selected_division))
        provinces = [p[0] for p in cur.fetchall()]
        if not provinces:
            print(f"No provinces found for division {selected_division}.")
            sys.exit(1)

        selected_province = get_selection(provinces, f"Select a Province in {selected_division}:")
        if not selected_province:
            print("Operation cancelled.")
            sys.exit(0)

        # 4. Enter Legislative District name
        leg_district = input(f"\nEnter Legislative District Name to Add (e.g., 2ND DISTRICT) for {selected_province}: ").strip()
        if not leg_district:
            print("Error: Legislative District name is required.")
            sys.exit(1)

        # Normalize to UPPER
        region = selected_region.upper().strip()
        division = selected_division.upper().strip()
        province = selected_province.upper().strip()
        leg_district = leg_district.upper().strip()

        print(f"\nAdding Legislative District to 'all_locations':")
        print(f"   Region: {region}")
        print(f"   Division: {division}")
        print(f"   Province: {province}")
        print(f"   Legislative District: {leg_district}")
        print(f"   (Municipality and District will be set to NULL)")

        # 5. Check for duplicate
        cur.execute("""
            SELECT id FROM all_locations 
            WHERE UPPER(TRIM(region)) = UPPER(TRIM(%s)) 
              AND UPPER(TRIM(division)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(province)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(legislative_district)) = UPPER(TRIM(%s))
              AND municipality IS NULL
        """, (region, division, province, leg_district))

        if cur.fetchone():
            print(f"\n[!] Legislative District '{leg_district}' already exists for this hierarchy.")
            # No changes made, just close cleanly
            conn.rollback()
        else:
            # 6. Insert — inside transaction, committed only on success
            cur.execute("""
                INSERT INTO all_locations (region, division, province, legislative_district, municipality, district) 
                VALUES (%s, %s, %s, %s, NULL, NULL)
            """, (region, division, province, leg_district))

            # HARDENED: explicit commit after successful insert
            conn.commit()
            print(f"\n[OK] Successfully added Legislative District '{leg_district}' to 'all_locations'.")

    except psycopg2.Error as e:
        if conn:
            conn.rollback()
        print(f"\n[ROLLBACK] Database Error — changes reverted: {str(e)}")
    except KeyboardInterrupt:
        if conn:
            conn.rollback()
        print("\n[ROLLBACK] Interrupted — changes reverted.")
    finally:
        if conn:
            conn.close()
