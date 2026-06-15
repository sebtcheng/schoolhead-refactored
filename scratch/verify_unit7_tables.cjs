const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: 'e:/InsightEd-SchoolHead-Official/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const tables = [
      'unit7_buildings_inventory',
      'unit7_buildings_repairs',
      'unit7_buildings_demolition',
      'unit7_school_buildable_spaces',
      'unit7_facilities',
    ];

    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);

      if (res.rows.length === 0) {
        console.log(`❌ Table NOT FOUND: ${table}`);
      } else {
        console.log(`✅ ${table} (${res.rows.length} columns):`);
        res.rows.forEach(r => console.log(`   - ${r.column_name} [${r.data_type}]`));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
run();
