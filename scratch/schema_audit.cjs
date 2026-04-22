const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("--- SCHEMA AUDIT ---");
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'import_beff_projects'
    `);
    console.table(res.rows);

    const searchPath = await client.query("SHOW search_path");
    console.log(`Current search_path: ${searchPath.rows[0].search_path}`);

    // Check count for each schema found
    for (const row of res.rows) {
       const countRes = await client.query(`SELECT COUNT(*) FROM "${row.table_schema}"."${row.table_name}"`);
       const repairRes = await client.query(`SELECT COUNT(*) FROM "${row.table_schema}"."${row.table_name}" WHERE project_category ILIKE '%Repair%'`);
       console.log(`Schema: ${row.table_schema} | All rows: ${countRes.rows[0].count} | Repair Rows: ${repairRes.rows[0].count}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
