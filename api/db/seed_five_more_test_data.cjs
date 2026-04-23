const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedFiveMore() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const testData = [
      {
        tlid: 'TL-2026-TEST-001',
        strand: 'TEST STRAND',
        office: 'TEST BUREAU C',
        name: 'ANDRES BONIFACIO',
        position: 'DIRECTOR IV',
        email: 'andres.bonifacio@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-01-15'
      },
      {
        tlid: 'TL-2026-TEST-002',
        strand: 'STRAND TEST',
        office: 'LEGAL SERVICE',
        name: 'APOLINARIO MABINI',
        position: 'DIRECTOR III',
        email: 'apolinario.mabini@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-02-20'
      },
      {
        tlid: 'TL-2026-TEST-003',
        strand: 'OPERATIONS',
        office: 'REGION IV-A',
        name: 'MELCHORA AQUINO',
        position: 'ASSISTANT REGIONAL DIRECTOR',
        email: 'melchora.aquino@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-03-10'
      },
      {
        tlid: 'TL-2026-TEST-004',
        strand: 'CURRICULUM',
        office: 'BUREAU OF CURRICULUM DEVELOPMENT',
        name: 'GABRIELA SILANG',
        position: 'DIRECTOR IV',
        email: 'gabriela.silang@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-04-05'
      },
      {
        tlid: 'TL-2026-TEST-005',
        strand: 'ADMINISTRATION',
        office: 'PUBLIC AFFAIRS SERVICE',
        name: 'MARCELO H. DEL PILAR',
        position: 'DIRECTOR IV',
        email: 'marcelo.delpilar@deped.gov.ph',
        status: 'Active',
        assignment_date: '2025-05-12'
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
      `, [data.tlid, 1300, data.strand, data.office, data.name, data.position, data.email, data.status, data.assignment_date]);

      // 2. Insert into Ledger
      await client.query(`
        INSERT INTO third_level_officials_updates 
          (tlid, sort_index, strand, office, name, position, email, status, change_type, updated_by, assignment_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING;
      `, [
        data.tlid, 1300, data.strand, data.office, data.name, data.position, 
        data.email, data.status, 'INITIAL_ENTRY', 'system-admin@deped.gov.ph', data.assignment_date
      ]);
    }

    await client.query('COMMIT');
    console.log('✅ 5 more test records added successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed data:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedFiveMore();
