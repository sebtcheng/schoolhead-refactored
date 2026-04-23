const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addThird() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tlid = 'TL-2026-SEED-003';
    await client.query(`
      INSERT INTO third_level_officials_masterlist (tlid, sort_index, strand, office, name, position, email, status, assignment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tlid) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position;
    `, [tlid, 520, 'OPERATIONS', 'REGION III - CENTRAL LUZON', 'RONALDO A. POZON', 'DIRECTOR IV', 'ronaldo.pozon@deped.gov.ph', 'Active', '2025-01-10']);

    await client.query(`
      INSERT INTO third_level_officials_updates (tlid, sort_index, strand, office, name, position, email, status, change_type, updated_by)
      VALUES ($1, 520, 'OPERATIONS', 'REGION III - CENTRAL LUZON', 'RONALDO A. POZON', 'DIRECTOR IV', 'ronaldo.pozon@deped.gov.ph', 'Active', 'INITIAL_ENTRY', 'system-admin@deped.gov.ph')
      ON CONFLICT DO NOTHING;
    `, [tlid]);

    await client.query('COMMIT');
    console.log('✅ Third test official added.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add third official:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addThird();
