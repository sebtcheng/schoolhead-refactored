import os
import psycopg2
from dotenv import load_dotenv
import sys

# Load environment variables from .env file in the parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

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

def add_district(region, division, district_name):
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    conn = None
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cur = conn.cursor()

        # Normalize to UPPER
        region = region.upper().strip()
        division = division.upper().strip()
        district_name = district_name.upper().strip()

        print(f"\nℹ️ Adding District to 'all_locations_district':")
        print(f"   Region: {region}")
        print(f"   Division: {division}")
        print(f"   District: {district_name}")

        # 1. Check for duplicate
        cur.execute("""
            SELECT region FROM all_locations_district 
            WHERE UPPER(TRIM(region)) = UPPER(TRIM(%s)) 
              AND UPPER(TRIM(division)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(district)) = UPPER(TRIM(%s))
        """, (region, division, district_name))

        if cur.fetchone():
            print(f"\n[!] District '{district_name}' already exists for this hierarchy.")
            conn.rollback()
            return False
        else:
            # 2. Insert — inside transaction, committed only on success
            cur.execute("""
                INSERT INTO all_locations_district (region, division, district) 
                VALUES (%s, %s, %s)
            """, (region, division, district_name))

            conn.commit()
            print(f"\n[OK] Successfully added District '{district_name}' to 'all_locations_district'.")
            return True

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\n[ERROR] Database Error: {str(e)}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("--- Add District to Database (all_locations_district) ---")

    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("Error: DATABASE_URL not found in .env file.")
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()

        # 1. Select Region
        cur.execute("SELECT DISTINCT region FROM all_locations_district WHERE region IS NOT NULL ORDER BY region")
        regions = [r[0] for r in cur.fetchall()]
        if not regions:
            print("No regions found in 'all_locations_district'.")
            sys.exit(1)

        selected_region = get_selection(regions, "Select a Region:")
        if not selected_region:
            print("Operation cancelled.")
            sys.exit(0)

        # 2. Select Division
        cur.execute("""
            SELECT DISTINCT division 
            FROM all_locations_district 
            WHERE region = %s AND division IS NOT NULL 
              AND division != 'NOT APPLICABLE'
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

        # 3. Enter District name
        district_name = input(f"\nEnter District Name to Add (e.g., TALACOGON WEST) for {selected_division}: ").strip()
        
        if not district_name:
            print("Error: District name is required.")
        else:
            add_district(selected_region, selected_division, district_name)

        cur.close()
        conn.close()

    except psycopg2.Error as e:
        print(f"\n[ERROR] Database Connection Error: {str(e)}")
    except KeyboardInterrupt:
        print("\nExiting...")
