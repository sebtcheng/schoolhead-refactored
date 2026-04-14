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
                print(f"❌ Invalid selection. Please choose 1-{len(options)}.")
        except ValueError:
            print("❌ Please enter a number.")

def add_barangay(region, province, municipality, barangay):
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    try:
        # Connect to the database
        conn = psycopg2.connect(database_url, sslmode='require')
        cur = conn.cursor()

        # Force all caps for consistency
        region = region.upper().strip()
        province = province.upper().strip()
        municipality = municipality.upper().strip()
        barangay = barangay.upper().strip()

        print(f"\nℹ️ Creating barangay mapping in 'ph_barangays' for:")
        print(f"   Region: {region}")
        print(f"   Province: {province}")
        print(f"   Municipality: {municipality}")
        print(f"   Barangay: {barangay}")

        # 1. Check if the exact combination already exists in ph_barangays
        check_query = """
            SELECT id FROM ph_barangays 
            WHERE UPPER(TRIM(region)) = UPPER(TRIM(%s)) 
              AND UPPER(TRIM(province)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(municipality)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(barangay)) = UPPER(TRIM(%s))
        """
        cur.execute(check_query, (region, province, municipality, barangay))
        
        if cur.fetchone():
            print(f"\n[!] Barangay '{barangay}' already exists in 'ph_barangays' for this location.")
        else:
            # 2. Insert the new barangay mapping
            insert_query = """
                INSERT INTO ph_barangays (region, province, municipality, barangay) 
                VALUES (%s, %s, %s, %s)
            """
            cur.execute(insert_query, (region, province, municipality, barangay))
            conn.commit()
            print(f"\n[✅] Successfully added Barangay '{barangay}' to 'ph_barangays'.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n[ERROR] Database Error: {str(e)}")

if __name__ == "__main__":
    print("--- Add Barangay to Database (ph_barangays) ---")
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        sys.exit(1)

    try:
        conn = psycopg2.connect(database_url, sslmode='require')
        cur = conn.cursor()

        # 1. Select Region
        cur.execute("SELECT DISTINCT region FROM ph_barangays WHERE region IS NOT NULL ORDER BY region")
        regions = [r[0] for r in cur.fetchall()]
        
        if not regions:
            print("❌ No regions found in database.")
            sys.exit(1)

        selected_region = get_selection(regions, "Select a Region:")
        if not selected_region:
            print("Operation cancelled.")
            sys.exit(0)

        # 2. Select Province
        cur.execute("""
            SELECT DISTINCT province 
            FROM ph_barangays 
            WHERE region = %s AND province IS NOT NULL 
            ORDER BY province
        """, (selected_region,))
        
        provinces = [p[0] for p in cur.fetchall()]

        if not provinces:
            print(f"❌ No provinces found for region {selected_region}.")
            sys.exit(1)

        selected_province = get_selection(provinces, f"Select a Province in {selected_region}:")
        if not selected_province:
            print("Operation cancelled.")
            sys.exit(0)

        # 3. Select Municipality
        cur.execute("""
            SELECT DISTINCT municipality 
            FROM ph_barangays 
            WHERE region = %s AND province = %s AND municipality IS NOT NULL 
            ORDER BY municipality
        """, (selected_region, selected_province))
        
        municipalities = [m[0] for m in cur.fetchall()]

        if not municipalities:
            print(f"❌ No municipalities found for province {selected_province}.")
            sys.exit(1)

        selected_municipality = get_selection(municipalities, f"Select a Municipality in {selected_province}:")
        if not selected_municipality:
            print("Operation cancelled.")
            sys.exit(0)
            
        # 4. Enter Barangay
        barangay = input(f"\nEnter Barangay Name to Add to {selected_municipality}: ").strip()

        if not barangay:
            print("❌ Error: Barangay name is required.")
        else:
            add_barangay(selected_region, selected_province, selected_municipality, barangay)

        cur.close()
        conn.close()

    except psycopg2.Error as e:
        print(f"\n[ERROR] Database Connection Error: {str(e)}")
    except KeyboardInterrupt:
        print("\nExiting...")
