import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();

  for (const t of ['school_unit1_profile', 'school_unit2_enrollment', 'school_unit3_classes', 'school_unit4_demographics']) {
    try {
      const res = await client.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`Table ${t}: ${res.rows[0].count} rows`);
    } catch (e) {
      console.error(`Error on ${t}:`, e.message);
    }
  }

  await client.end();
}
main().catch(console.error);
