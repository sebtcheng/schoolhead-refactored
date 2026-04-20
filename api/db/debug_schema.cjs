const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", tablesRes.rows.map(r => r.table_name));

    const colsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'third_level_officials'");
    console.log("Columns in third_level_officials:", colsRes.rows.map(r => r.column_name));
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
