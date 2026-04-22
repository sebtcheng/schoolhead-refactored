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
         AND (
           lower(column_name) LIKE '%abc%'
           OR lower(column_name) LIKE '%budget%'
           OR lower(column_name) LIKE '%contract%'
           OR lower(column_name) LIKE '%school%'
           OR lower(column_name) LIKE '%fund%'
           OR lower(column_name) LIKE '%year%'
           OR lower(column_name) LIKE '%region%'
         )
         ORDER BY ordinal_position`,
        [tbl]
      );
      console.log(`\n=== ${tbl} relevant columns ===`);
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
