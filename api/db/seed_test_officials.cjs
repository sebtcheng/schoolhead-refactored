const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Official A
    const tlidA = 'TL-2026-SEED-001';
    await client.query(`
      INSERT INTO third_level_officials_masterlist (tlid, sort_index, strand, office, name, position, email, status, assignment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tlid) DO NOTHING;
    `, [tlidA, 500, 'CURRICULUM AND TEACHING', 'BUREAU OF LEARNING DELIVERY', 'ANGELITA M. ESGUERRA', 'DIRECTOR IV', 'angelita.esguerra@deped.gov.ph', 'Active', '2025-06-15']);

    // Official B
    const tlidB = 'TL-2026-SEED-002';
    await client.query(`
      INSERT INTO third_level_officials_masterlist (tlid, sort_index, strand, office, name, position, email, status, assignment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tlid) DO NOTHING;
    `, [tlidB, 510, 'OPERATIONS', 'BUREAU OF HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT', 'MARIO M. MADERA', 'DIRECTOR IV', 'mario.madera@deped.gov.ph', 'Active', '2024-11-20']);

    // Log initials in Ledger
    await client.query(`
      INSERT INTO third_level_officials_updates (tlid, sort_index, strand, office, name, position, email, status, change_type, updated_by)
      VALUES 
      ($1, 500, 'CURRICULUM AND TEACHING', 'BUREAU OF LEARNING DELIVERY', 'ANGELITA M. ESGUERRA', 'DIRECTOR IV', 'angelita.esguerra@deped.gov.ph', 'Active', 'INITIAL_ENTRY', 'system-admin@deped.gov.ph'),
      ($2, 510, 'OPERATIONS', 'BUREAU OF HUMAN RESOURCE AND ORGANIZATIONAL DEVELOPMENT', 'MARIO M. MADERA', 'DIRECTOR IV', 'mario.madera@deped.gov.ph', 'Active', 'INITIAL_ENTRY', 'system-admin@deped.gov.ph')
      ON CONFLICT DO NOTHING;
    `, [tlidA, tlidB]);

    await client.query('COMMIT');
    console.log('✅ Sample data seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
