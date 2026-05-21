import psycopg2

def fix_conversions():
    db_url = "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd"
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Find conversions in pending_schools that are not in schools_IERN
        query = """
        SELECT ps.school_id, ps.old_school_id, ps.school_name, ps.region, ps.division, ps.district, 
               ps.province, ps.municipality, ps.leg_district, ps.barangay, ps.latitude, 
               ps.longitude, ps.curricular_offering, ps.street_address, ps.mother_school_id
        FROM pending_schools ps
        WHERE ps.registration_type = 'conversion'
        AND ps.school_id NOT IN (
            SELECT "SchoolID" FROM "schools_IERN" WHERE "SchoolID" IS NOT NULL
        )
        """
        cur.execute(query)
        mismatches = cur.fetchall()
        
        print(f"Found {len(mismatches)} missing conversions to backfill.")
        
        for m in mismatches:
            school_id, old_school_id, school_name, region, division, district, \
            province, municipality, leg_district, barangay, latitude, \
            longitude, curricular_offering, street_address, mother_school_id = m
            
            print(f"Backfilling {school_id} ({school_name})...")
            
            # Find old IERN
            cur.execute('SELECT "IERN" FROM "schools_IERN" WHERE "SchoolID" = %s LIMIT 1', (old_school_id,))
            res = cur.fetchone()
            old_iern = res[0] if res else 'CONV-PENDING'
            
            # Insert into schools_IERN
            insert_query = """
            INSERT INTO "schools_IERN" (
                "SchoolID", "IERN", "School_Name", "Region", "Division", "District", 
                "Province", "Municipality", "Legislative_District", "Barangay", 
                "Latitude", "Longitude", "Curricular_Offering", "Street_Address", 
                "Mother_School_ID", "status", "updated_at"
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Active', CURRENT_TIMESTAMP)
            """
            cur.execute(insert_query, (
                school_id, old_iern, school_name, region, division, district,
                province, municipality, leg_district, barangay, latitude,
                longitude, curricular_offering, street_address, mother_school_id
            ))
            print(f"Successfully backfilled {school_id} with IERN {old_iern}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_conversions()
