const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });

async function run() {
  try {
    // Check current id column definition
    const col = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'ph_school_buildable_spaces' AND column_name = 'id'
    `);
    console.log('Current id column:', col.rows[0]);

    // Create a sequence if not exists and set it as the default
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS ph_school_buildable_spaces_id_seq;
    `);

    // Set the sequence to the current max id + 1 to avoid conflicts
    await pool.query(`
      SELECT setval('ph_school_buildable_spaces_id_seq', COALESCE((SELECT MAX(id) FROM ph_school_buildable_spaces), 0) + 1, false);
    `);

    // Set the default on the id column
    await pool.query(`
      ALTER TABLE ph_school_buildable_spaces 
      ALTER COLUMN id SET DEFAULT nextval('ph_school_buildable_spaces_id_seq');
    `);

    // Verify
    const verify = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'ph_school_buildable_spaces' AND column_name = 'id'
    `);
    console.log('Fixed id column:', verify.rows[0]);
    console.log('✅ ph_school_buildable_spaces.id now has a SERIAL sequence');
  } catch (e) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}
run();
