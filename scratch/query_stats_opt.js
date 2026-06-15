import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

const query = `
WITH buildable_exists AS (
    SELECT DISTINCT iern AS key_id FROM ph_school_buildable_spaces WHERE iern IS NOT NULL
    UNION
    SELECT DISTINCT school_id AS key_id FROM ph_school_buildable_spaces WHERE school_id IS NOT NULL
),
demolition_exists AS (
    SELECT DISTINCT iern AS key_id FROM ph_buildings_demolition WHERE iern IS NOT NULL
    UNION
    SELECT DISTINCT school_id AS key_id FROM ph_buildings_demolition WHERE school_id IS NOT NULL
)
SELECT 
    si."Region" AS region,
    COUNT(CASE WHEN (be.key_id IS NOT NULL OR be2.key_id IS NOT NULL) AND (de.key_id IS NULL AND de2.key_id IS NULL) THEN 1 END) AS space_no_demo,
    COUNT(CASE WHEN (be.key_id IS NOT NULL OR be2.key_id IS NOT NULL) AND (de.key_id IS NOT NULL OR de2.key_id IS NOT NULL) THEN 1 END) AS space_and_demo,
    COUNT(CASE WHEN (be.key_id IS NULL AND be2.key_id IS NULL) AND (de.key_id IS NOT NULL OR de2.key_id IS NOT NULL) THEN 1 END) AS demo_no_space
FROM "schools_IERN" si
LEFT JOIN buildable_exists be ON si."IERN" = be.key_id
LEFT JOIN buildable_exists be2 ON si."SchoolID" = be2.key_id
LEFT JOIN demolition_exists de ON si."IERN" = de.key_id
LEFT JOIN demolition_exists de2 ON si."SchoolID" = de2.key_id
WHERE si."SchoolID" NOT LIKE '999%'
  AND si."IERN" NOT LIKE '999%'
  AND si."Region" IS NOT NULL
  AND TRIM(si."Region") != ''
  AND UPPER(si."Region") != 'BLANK REGION'
GROUP BY si."Region"
ORDER BY si."Region";
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔄 Fetching statistics using optimized query...');
    const startTime = Date.now();
    const result = await client.query(query);
    console.log(`⏱️ Query finished in ${((Date.now() - startTime) / 1000).toFixed(2)} seconds.`);
    console.log('📊 Result Rows:');
    console.table(result.rows);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main();
