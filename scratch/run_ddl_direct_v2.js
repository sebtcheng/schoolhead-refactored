import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

const viewQuery = `
DROP VIEW IF EXISTS ph_public_schools_location CASCADE;

CREATE OR REPLACE VIEW ph_public_schools_location AS
SELECT 
    si."IERN" AS iern,
    si."SchoolID" AS school_id,
    COALESCE(u1.school_name, si."School_Name") AS school_name,
    COALESCE(u1.region, si."Region") AS region,
    COALESCE(u1.province, si."Province") AS province,
    COALESCE(u1.municipality, si."Municipality") AS municipality,
    COALESCE(u1.barangay, si."Barangay") AS barangay,
    COALESCE(u1.division, si."Division") AS division,
    COALESCE(u1.district, si."District") AS district,
    COALESCE(u1.leg_district, si."Legislative_District") AS leg_district,
    COALESCE(u1.curricular_offering, si."Curricular_Offering") AS curricular_offering,
    COALESCE(u1.latitude, si."Latitude"::text) AS latitude,
    COALESCE(u1.longitude, si."Longitude"::text) AS longitude,
    EXISTS (
        SELECT 1 
        FROM ph_school_buildable_spaces bs 
        WHERE bs.iern = si."IERN" OR bs.school_id = si."SchoolID"
    )::boolean AS has_buildable_space,
    EXISTS (
        SELECT 1 
        FROM ph_buildings_demolition bd 
        WHERE bd.iern = si."IERN" OR bd.school_id = si."SchoolID"
    )::boolean AS has_building_demolition
FROM "schools_IERN" si
LEFT JOIN unit1_school_identity u1 ON si."IERN" = u1.iern
WHERE si."SchoolID" NOT LIKE '999%'
  AND si."IERN" NOT LIKE '999%'
  AND si."Region" IS NOT NULL
  AND TRIM(si."Region") != ''
  AND UPPER(si."Region") != 'BLANK REGION';
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting directly to Azure PostgreSQL staging database...');
    await client.connect();
    console.log('🔌 Connected! Creating/updating database view: ph_public_schools_location...');
    await client.query(viewQuery);
    console.log('✅ View ph_public_schools_location created/updated successfully!');
    
    console.log('🧪 Verifying view schema...');
    const result = await client.query('SELECT * FROM ph_public_schools_location LIMIT 1;');
    console.log('📊 Sample record:', result.rows[0]);
    
    const countRes = await client.query('SELECT COUNT(*) FROM ph_public_schools_location;');
    console.log('📊 Total active schools in view:', countRes.rows[0].count);
    
  } catch (error) {
    console.error('❌ Error executing DDL:', error);
  } finally {
    await client.end();
  }
}

main();
