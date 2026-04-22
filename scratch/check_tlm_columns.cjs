const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const tables = ['third_level_officials_masterlist', 'third_level_officials_updates', 'third_level_officials_profiles'];
    
    for (const table of tables) {
        console.log(`--- Columns in ${table} ---`);
        const res = await client.query(`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = '${table}' 
          ORDER BY ordinal_position
        `);
        if (res.rows.length === 0) {
            console.log(`Table ${table} does not exist or has no columns.`);
        } else {
            console.table(res.rows);
        }
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
