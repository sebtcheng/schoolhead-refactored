#!/usr/bin/env python3
import os
import sys
import psycopg2
import csv
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# --- CONFIGURATION ---
EXPORTS_DIR = "exports"
TABLES_TO_CHECK = [
    "ph_schools",
    "school_profiles",
    "school_location_profiles",
    "ph_buildings_inventory",
    "ph_buildings_repairs",
    "ph_buildings_demolition"
]

def load_env_vars():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("CRITICAL: DATABASE_URL not found in .env")
        sys.exit(1)
    return db_url

def get_active_columns(cur, table_name):
    """Returns a list of columns that have at least one non-null/non-empty value."""
    print(f"  🔍 Analysing active columns for {table_name}...")
    
    # 1. Get all columns
    cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table_name,))
    all_cols = [row['column_name'] for row in cur.fetchall()]
    
    active_cols = []
    for col in all_cols:
        # Check if column has any actual data
        # We check for NOT NULL and also not an empty string if it's text
        query = f'SELECT EXISTS (SELECT 1 FROM "{table_name}" WHERE "{col}" IS NOT NULL AND TRIM(CAST("{col}" AS TEXT)) != \'\')'
        cur.execute(query)
        if cur.fetchone()['exists']:
            active_cols.append(col)
            
    print(f"    - Found {len(active_cols)} active columns out of {len(all_cols)}.")
    return active_cols

def fetch_region_data(cur, region, schema_map):
    """Fetches and flattens data for a specific region."""
    print(f"  📥 Fetching data for Region: {region}...")
    
    # Unit 1-6, 8, 9 Data (School Level)
    # We join ph_schools with school_profiles and school_location_profiles
    school_cols = []
    for table, cols in schema_map.items():
        if table in ["ph_schools", "school_profiles", "school_location_profiles"]:
            school_cols.extend([f'p{i}."{c}" as "{table}_{c}"' for i, c in enumerate(cols)])

    # We use ph_schools as the anchor
    query = f"""
    SELECT {', '.join([f'p0."{c}" as "ph_schools_{c}"' for c in schema_map['ph_schools']])},
           {', '.join([f'p1."{c}" as "school_profiles_{c}"' for c in schema_map['school_profiles']])},
           {', '.join([f'p2."{c}" as "school_location_profiles_{c}"' for c in schema_map['school_location_profiles']])}
    FROM ph_schools p0
    LEFT JOIN school_profiles p1 ON p0.iern = p1.iern
    LEFT JOIN school_location_profiles p2 ON p0.school_id = p2.school_id
    WHERE TRIM(UPPER(p0."region")) = %s
    """
    cur.execute(query, (region,))
    schools = cur.fetchall()
    
    final_rows = []
    
    # For each school, we fetch Unit 7 (Buildings)
    for school in schools:
        school_id = school['ph_schools_school_id']
        
        # Fetch Buildings
        build_cols = [f'"{c}"' for c in schema_map['ph_buildings_inventory']]
        cur.execute(f'SELECT {", ".join(build_cols)} FROM ph_buildings_inventory WHERE school_id = %s', (school_id,))
        buildings = cur.fetchall()
        
        # Fetch Repairs
        repair_cols = [f'"{c}"' for c in schema_map['ph_buildings_repairs']]
        cur.execute(f'SELECT {", ".join(repair_cols)} FROM ph_buildings_repairs WHERE school_id = %s', (school_id,))
        repairs = cur.fetchall()

        # Fetch Demolitions
        demo_cols = [f'"{c}"' for c in schema_map['ph_buildings_demolition']]
        cur.execute(f'SELECT {", ".join(demo_cols)} FROM ph_buildings_demolition WHERE school_id = %s', (school_id,))
        demolitions = cur.fetchall()
        
        # We find the max rows needed across child tables to ensure no data is lost
        max_rows = max(len(buildings), len(repairs), len(demolitions), 1)
        
        for i in range(max_rows):
            row = dict(school)
            
            # Map Building i
            b_data = buildings[i] if i < len(buildings) else {}
            for c in schema_map['ph_buildings_inventory']:
                row[f"ph_buildings_inventory_{c}"] = b_data.get(c)
                
            # Map Repair i
            r_data = repairs[i] if i < len(repairs) else {}
            for c in schema_map['ph_buildings_repairs']:
                row[f"ph_buildings_repairs_{c}"] = r_data.get(c)

            # Map Demolition i
            d_data = demolitions[i] if i < len(demolitions) else {}
            for c in schema_map['ph_buildings_demolition']:
                row[f"ph_buildings_demolition_{c}"] = d_data.get(c)
                
            final_rows.append(row)
                
    return final_rows

def main():
    db_url = load_env_vars()
    
    if not os.path.exists(EXPORTS_DIR):
        os.makedirs(EXPORTS_DIR)
        
    conn = None
    try:
        conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
        cur = conn.cursor()
        
        print("--- Global Column Discovery ---")
        schema_map = {}
        for table in TABLES_TO_CHECK:
            schema_map[table] = get_active_columns(cur, table)
            
        # Get list of Regions
        cur.execute("SELECT DISTINCT TRIM(UPPER(region)) as reg FROM ph_schools WHERE region IS NOT NULL AND region != ''")
        regions = [row['reg'] for row in cur.fetchall()]
        print(f"Detected Regions: {', '.join(regions)}")
        
        for region in regions:
            data = fetch_region_data(cur, region, schema_map)
            
            if not data:
                print(f"  ⚠️ No data found for {region}")
                continue
                
            filename = f"{region.replace(' ', '_').replace('/', '_')}_Full_Unit_Extract.csv"
            filepath = os.path.join(EXPORTS_DIR, filename)
            
            # Use keys from first row for headers
            headers = data[0].keys()
            
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(data)
                
            print(f"  ✅ Exported {len(data)} rows to {filepath}")
            
        print("\n✨ Extraction Complete! Check the 'exports' folder.")

    except Exception as e:
        print(f"❌ ERROR: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
