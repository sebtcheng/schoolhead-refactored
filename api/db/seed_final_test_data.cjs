const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedFinalTest() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const testData = [
      {
        tlid: 'TL-2026-FINAL-001',
        strand: 'TEST STRAND',
        office: 'TEST BUREAU A',
        name: 'DABID MAKAO',
        position: 'DIRECTOR IV',
        email: 'dabid.makao@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-06-01'
      },
      {
        tlid: 'TL-2026-FINAL-002',
        strand: 'STRAND TEST',
        office: 'TEST BUREAU B',
        name: 'LEONOR BRIONES',
        position: 'SECRETARY',
        email: 'leonor.briones@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-07-01'
      }
    ];

    for (const data of testData) {
      // 1. Insert into Masterlist
      await client.query(`
        INSERT INTO third_level_officials_masterlist 
          (tlid, sort_index, strand, office, name, position, email, status, assignment_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tlid) DO UPDATE SET 
          strand = EXCLUDED.strand, 
          office = EXCLUDED.office, 
          name = EXCLUDED.name, 
          position = EXCLUDED.position;
      `, [data.tlid, 1100, data.strand, data.office, data.name, data.position, data.email, data.status, data.assignment_date]);

      // 2. Insert into Ledger
      await client.query(`
        INSERT INTO third_level_officials_updates 
          (tlid, sort_index, strand, office, name, position, email, status, change_type, updated_by, assignment_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING;
      `, [
        data.tlid, 1100, data.strand, data.office, data.name, data.position, 
        data.email, data.status, 'INITIAL_ENTRY', 'system-admin@deped.gov.ph', data.assignment_date
      ]);
    }

    await client.query('COMMIT');
    console.log('✅ Final test data batch added (2 records).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed final test data:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedFinalTest();
