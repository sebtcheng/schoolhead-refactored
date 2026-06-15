const { Pool } = require('pg');

const STAGING = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging';
const pool = new Pool({ connectionString: STAGING });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connected to: insighted-staging');

    await client.query(`
      CREATE TABLE IF NOT EXISTS unit7_facilities (
        iern VARCHAR(255) PRIMARY KEY,
        school_id VARCHAR(255) UNIQUE,
        unit7 INTEGER DEFAULT 0,
        unit7_completed BOOLEAN DEFAULT FALSE,
        unit7_updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        unit7_no_buildings INTEGER DEFAULT 0,
        unit7_no_rooms INTEGER DEFAULT 0,
        unit7_has_buildable_space BOOLEAN DEFAULT TRUE,
        unit7_no_buildable_space INTEGER DEFAULT 0,
        unit7_no_repair_rooms INTEGER DEFAULT 0,
        unit7_no_demolition INTEGER DEFAULT 0
      );
    `);
    console.log('✅ unit7_facilities table created/verified on insighted-staging');

    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'unit7_facilities' 
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`   - ${r.column_name} [${r.data_type}]`));
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
