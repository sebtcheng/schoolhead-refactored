#!/usr/bin/env python3
"""
Regional School Migration Audit Tool
Provides a breakdown of migration coverage per region.
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env", file=sys.stderr)
        sys.exit(1)

    print("--- Regional School Migration Audit Initialized ---")
    
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            # Complex CTE to get stats per region
            query = """
            WITH legacy_counts AS (
                SELECT TRIM(UPPER("Region")) as region_name, COUNT(*) as total_legacy
                FROM "schools_IERN"
                WHERE "Region" IS NOT NULL 
                  AND TRIM(UPPER("Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                GROUP BY TRIM(UPPER("Region"))
            ),
            migrated_counts AS (
                SELECT TRIM(UPPER(legacy."Region")) as region_name, COUNT(DISTINCT legacy.iern) as migrated_count
                FROM "schools_IERN" legacy
                JOIN ph_schools prod ON legacy.iern = prod.iern
                WHERE legacy."Region" IS NOT NULL 
                  AND TRIM(UPPER(legacy."Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                GROUP BY TRIM(UPPER(legacy."Region"))
            ),
            completed_counts AS (
                SELECT TRIM(UPPER(legacy."Region")) as region_name, COUNT(DISTINCT legacy.iern) as completed_count
                FROM "schools_IERN" legacy
                JOIN ph_school_completion comp ON legacy.iern = comp.iern
                WHERE legacy."Region" IS NOT NULL 
                  AND TRIM(UPPER(legacy."Region")) NOT IN ('', 'BLANK', 'BLANK REGION')
                  AND comp.total_completion = 100
                GROUP BY TRIM(UPPER(legacy."Region"))
            )
            SELECT 
                l.region_name,
                l.total_legacy,
                COALESCE(m.migrated_count, 0) as migrated_count,
                COALESCE(c.completed_count, 0) as completed_count,
                ROUND((COALESCE(m.migrated_count, 0)::numeric / l.total_legacy * 100), 2) as reg_percentage,
                ROUND((COALESCE(c.completed_count, 0)::numeric / l.total_legacy * 100), 2) as comp_percentage
            FROM legacy_counts l
            LEFT JOIN migrated_counts m ON l.region_name = m.region_name
            LEFT JOIN completed_counts c ON l.region_name = c.region_name
            ORDER BY reg_percentage DESC, l.region_name ASC;
            """
            cur.execute(query)
            rows = cur.fetchall()

            # Output Table
            headers = ["Region", "Total", "Registered", "100% Comp", "Reg %", "Comp %"]
            col_widths = [26, 8, 12, 12, 10, 10]
            
            # Border
            border = "+" + "+".join("-" * w for w in col_widths) + "+"
            print(border)
            
            # Header
            header_row = "|" + "|".join(f" {h}".ljust(w-1) for h, w in zip(headers, col_widths)) + "|"
            print(header_row)
            print(border)
            
            grand_legacy = 0
            grand_migrated = 0
            grand_completed = 0
            
            for row in rows:
                region, legacy, migrated, completed, reg_pct, comp_pct = row
                row_str = f"| {str(region)[:24]}".ljust(col_widths[0]) + \
                         f"| {str(legacy)}".ljust(col_widths[1]) + \
                         f"| {str(migrated)}".ljust(col_widths[2]) + \
                         f"| {str(completed)}".ljust(col_widths[3]) + \
                         f"| {str(reg_pct)}%".ljust(col_widths[4]) + \
                         f"| {str(comp_pct)}%".ljust(col_widths[5]) + "|"
                print(row_str)
                grand_legacy += legacy
                grand_migrated += migrated
                grand_completed += completed
            
            print(border)
            
            # Grand Total
            total_reg_pct = round((grand_migrated / grand_legacy * 100), 2) if grand_legacy > 0 else 0
            total_comp_pct = round((grand_completed / grand_legacy * 100), 2) if grand_legacy > 0 else 0
            footer_row = f"| {'GRAND TOTAL'.ljust(col_widths[0]-1)} " + \
                         f"| {str(grand_legacy)}".ljust(col_widths[1]) + \
                         f"| {str(grand_migrated)}".ljust(col_widths[2]) + \
                         f"| {str(grand_completed)}".ljust(col_widths[3]) + \
                         f"| {str(total_reg_pct)}%".ljust(col_widths[4]) + \
                         f"| {str(total_comp_pct)}%".ljust(col_widths[5]) + "|"
            print(footer_row)
            print(border)

    except Exception as e:
        print(f"CRITICAL: Regional audit failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
