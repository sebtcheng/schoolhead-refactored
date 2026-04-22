const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Phase 1: Creating Application Header ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_applications (
        application_id SERIAL PRIMARY KEY,
        tlid TEXT, 
        fullname TEXT NOT NULL,
        current_position TEXT,
        position_applied_for TEXT NOT NULL,
        age INTEGER,
        photo_binary_id UUID, 
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('--- Phase 2: Creating Related Sub-Tables with Redundant tlid ---');

    // Managerial Experience
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_app_experience (
        experience_id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES third_level_officials_applications(application_id) ON DELETE CASCADE,
        tlid TEXT, 
        position TEXT,
        location TEXT,
        duration TEXT,
        sort_order INTEGER
      );
    `);

    // Educational Attainment
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_app_education (
        education_id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES third_level_officials_applications(application_id) ON DELETE CASCADE,
        tlid TEXT, 
        university TEXT,
        degree TEXT,
        year_graduated TEXT,
        sort_order INTEGER
      );
    `);

    // Performance Ratings
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_app_ratings (
        rating_id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES third_level_officials_applications(application_id) ON DELETE CASCADE,
        tlid TEXT, 
        period TEXT,
        rating NUMERIC(4,2),
        sort_order INTEGER
      );
    `);

    // Eligibilities
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_level_officials_app_eligibility (
        eligibility_id SERIAL PRIMARY KEY,
        application_id INTEGER REFERENCES third_level_officials_applications(application_id) ON DELETE CASCADE,
        tlid TEXT, 
        eligibility TEXT,
        date_acquired DATE,
        sort_order INTEGER
      );
    `);

    console.log('--- Phase 3: Creating Indices ---');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tloa_tlid ON third_level_officials_applications(tlid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tloa_status ON third_level_officials_applications(status);`);

    await client.query('COMMIT');
    console.log('\n✅ Third Level Officials Applications Schema created successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
