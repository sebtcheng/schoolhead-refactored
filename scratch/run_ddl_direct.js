import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

const viewQuery = `
CREATE OR REPLACE VIEW ph_public_schools_location AS
SELECT 
    ps.iern,
    ps.school_id,
    COALESCE(u1.school_name, ps.school_name) AS school_name,
    COALESCE(u1.region, ps.region) AS region,
    COALESCE(u1.province, ps.province) AS province,
    COALESCE(u1.municipality, ps.municipality) AS municipality,
    COALESCE(u1.barangay, ps.barangay) AS barangay,
    COALESCE(u1.division, ps.division) AS division,
    COALESCE(u1.district, ps.district) AS district,
    COALESCE(u1.leg_district, ps.leg_district) AS leg_district,
    COALESCE(u1.curricular_offering, ps.curricular_offering) AS curricular_offering,
    COALESCE(u1.latitude, ps.latitude) AS latitude,
    COALESCE(u1.longitude, ps.longitude) AS longitude,
    EXISTS (
        SELECT 1 
        FROM ph_school_buildable_spaces bs 
        WHERE bs.iern = ps.iern OR bs.school_id = ps.school_id
    )::boolean AS has_buildable_space,
    EXISTS (
        SELECT 1 
        FROM ph_buildings_demolition bd 
        WHERE bd.iern = ps.iern OR bd.school_id = ps.school_id
    )::boolean AS has_building_demolition
FROM ph_schools ps
LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern;
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting directly to Azure PostgreSQL staging database...');
    await client.connect();
    console.log('🔌 Connected! Creating database view: ph_public_schools_location...');
    await client.query(viewQuery);
    console.log('✅ View ph_public_schools_location created successfully!');
    
    console.log('🧪 Verifying view schema...');
    const result = await client.query('SELECT * FROM ph_public_schools_location LIMIT 1;');
    console.log('📊 Sample record fields:', Object.keys(result.rows[0] || {}));
  } catch (error) {
    console.error('❌ Error executing DDL:', error);
  } finally {
    await client.end();
  }
}

main();
