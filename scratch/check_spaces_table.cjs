const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });

async function run() {
  try {
    // Check indexes
    const idx = await pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ph_school_buildable_spaces'
    `);
    console.log('Indexes on ph_school_buildable_spaces:');
    if (idx.rows.length === 0) console.log('  (no indexes found)');
    idx.rows.forEach(r => console.log(' -', r.indexname, ':', r.indexdef));

    // Check columns
    const cols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'ph_school_buildable_spaces' ORDER BY ordinal_position
    `);
    console.log('\nColumns:');
    cols.rows.forEach(r => console.log(' -', r.column_name, '[' + r.data_type + ']'));
  } catch(e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}
run();
