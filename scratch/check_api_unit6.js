import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log("Connected to DB.");

  const res = await client.query(`
    SELECT id, school_id, iern, school_yr, unit6_updated_at, laptops_total, water_source, utility_electricity 
    FROM unit6_school_resources 
    WHERE unit6_updated_at >= '2026-06-14 00:00:00' AND unit6_updated_at <= '2026-06-16 23:59:59'
  `);
  
  console.log("Found rows updated around 2026-06-15:", res.rowCount);
  if (res.rowCount > 0) {
    console.table(res.rows);
  }

  await client.end();
}
main().catch(console.error);
