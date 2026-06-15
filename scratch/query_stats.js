import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

const query = `
SELECT 
    region,
    COUNT(CASE WHEN has_buildable_space = true AND has_building_demolition = false THEN 1 END) AS space_no_demo,
    COUNT(CASE WHEN has_buildable_space = true AND has_building_demolition = true THEN 1 END) AS space_and_demo,
    COUNT(CASE WHEN has_buildable_space = false AND has_building_demolition = true THEN 1 END) AS demo_no_space
FROM ph_public_schools_location
GROUP BY region
ORDER BY region;
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔄 Fetching statistics from ph_public_schools_location view...');
    const result = await client.query(query);
    console.log('📊 Result Rows:');
    console.table(result.rows);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main();
