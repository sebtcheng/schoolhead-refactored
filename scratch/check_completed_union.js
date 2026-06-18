import pg from 'pg';
const { Client } = pg;

const clientStaging = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

const clientProd = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await clientStaging.connect();
  await clientProd.connect();

  // 1. Completed in production
  const prodCompleted = await clientProd.query(`
    SELECT school_id, iern FROM ph_schools
    WHERE unit3_completed = TRUE OR unit3 = 100
  `);
  console.log(`Completed in production ph_schools: ${prodCompleted.rows.length}`);

  // 2. Completed in staging
  const stagingCompleted = await clientStaging.query(`
    SELECT school_id, iern FROM ph_schools
    WHERE unit3_completed = TRUE OR unit3 = 100
  `);
  console.log(`Completed in staging ph_schools: ${stagingCompleted.rows.length}`);

  // 3. Let's find schools completed in prod but not in staging
  const prodIds = new Set(prodCompleted.rows.map(r => r.school_id));
  const stagingIds = new Set(stagingCompleted.rows.map(r => r.school_id));

  let prodOnly = 0;
  let stagingOnly = 0;

  for (const row of prodCompleted.rows) {
    if (!stagingIds.has(row.school_id)) {
      prodOnly++;
    }
  }

  for (const row of stagingCompleted.rows) {
    if (!prodIds.has(row.school_id)) {
      stagingOnly++;
    }
  }

  console.log(`Schools completed in Production ONLY: ${prodOnly}`);
  console.log(`Schools completed in Staging ONLY: ${stagingOnly}`);

  // Union of school_ids that are completed in either, or have non-null simplified counts in prod
  const prodWithCounts = await clientProd.query(`
    SELECT school_id FROM ph_schools WHERE unit3_simplified_counts IS NOT NULL
  `);
  console.log(`Schools with unit3_simplified_counts in production: ${prodWithCounts.rows.length}`);

  const unionSet = new Set();
  prodCompleted.rows.forEach(r => unionSet.add(r.school_id));
  stagingCompleted.rows.forEach(r => unionSet.add(r.school_id));
  prodWithCounts.rows.forEach(r => unionSet.add(r.school_id));

  console.log(`Union of all unique school IDs that are completed in either database or have production counts: ${unionSet.size}`);

  await clientStaging.end();
  await clientProd.end();
}

main().catch(console.error);
