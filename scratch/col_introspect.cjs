const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    for (const tbl of ['engineer_form', 'import_beff_projects']) {
      const res = await client.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY ordinal_position`,
        [tbl]
      );
      console.log(`\n=== ${tbl} columns ===`);
      res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    }
  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
