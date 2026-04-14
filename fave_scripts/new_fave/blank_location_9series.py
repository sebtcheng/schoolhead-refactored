import os
import psycopg2
from dotenv import load_dotenv

def main():
    # Load environment variables
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("Error: DATABASE_URL not found in environment variables.")
        return

    # Configuration for tables and their location columns
    # Format: (table_name, id_column, {db_column_name: display_name_for_blank})
    TABLES_TO_RESET = [
        ('ph_schools', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division',
            'district': 'Blank District',
            'barangay': 'Blank Barangay',
            'leg_district': 'Blank Legislative District',
            'province': 'Blank Province',
            'municipality': 'Blank Municipality'
        }),
        ('schools', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division',
            'district': 'Blank District',
            'barangay': 'Blank Barangay',
            'leg_district': 'Blank Legislative District',
            'province': 'Blank Province',
            'municipality': 'Blank Municipality'
        }),
        ('school_profiles', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division',
            'district': 'Blank District',
            'barangay': 'Blank Barangay',
            'leg_district': 'Blank Legislative District',
            'province': 'Blank Province',
            'municipality': 'Blank Municipality'
        }),
        ('schools_IERN', 'iern', {
            'Region': 'Blank Region',
            'Division': 'Blank Division',
            'District': 'Blank District',
            'Barangay': 'Blank Barangay',
            'Legislative_District': 'Blank Legislative District',
            'Province': 'Blank Province',
            'Municipality': 'Blank Municipality'
        }),
        ('ph_school_completion', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division'
        }),
        ('school_summary', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division',
            'district': 'Blank District'
        }),
        ('users', 'school_id', {
            'region': 'Blank Region',
            'division': 'Blank Division',
            'province': 'Blank Province',
            'barangay': 'Blank Barangay'
        })
    ]

    try:
        # Connect to the database
        conn = psycopg2.connect(database_url, sslmode='require')
        cur = conn.cursor()

        print("--- InsightEd Location Reset Tool (9-series Schools) ---")
        print("Expanding search across multiple tables...\n")
        
        total_updated = 0
        
        for table, id_col, columns in TABLES_TO_RESET:
            try:
                set_clause = ", ".join([f"\"{col}\" = %s" for col in columns.keys()])
                values = list(columns.values())
                
                # SQL Update Query
                update_query = f"""
                    UPDATE \"{table}\"
                    SET {set_clause}
                    WHERE \"{id_col}\"::text LIKE '9%%'
                """

                print(f"Updating table: {table}...")
                cur.execute(update_query, values)
                rows_affected = cur.rowcount
                total_updated += rows_affected
                
                # Commit individual table success
                conn.commit()
                print(f"  -> SUCCESS: {rows_affected} records updated.")
            except Exception as e:
                conn.rollback()
                print(f"  -> FAILED: Table {table}. Error: {str(e).splitlines()[0]}")
                continue

        print(f"\nCompleted: Total of {total_updated} records updated across successful tables.")

        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    main()
