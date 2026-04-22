const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'third_level_officials_app%'");
    console.log("Created Tables:", res.rows.map(r => r.table_name));
    
    for (const table of res.rows.map(r => r.table_name)) {
        const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
        console.log(`\nSchema for ${table}:`);
        console.table(cols.rows);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verify();
