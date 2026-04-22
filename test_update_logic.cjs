const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testUpdate() {
  const tlid = 'TL-2026-0001';
  const newEmail = 'test_update@example.com';
  
  console.log('Testing update for', tlid);
  
  try {
    // We simulate the API logic here since we can't easily call the API without auth complexeties in a script
    // but we can verify the logic works at the DB level
    
    await pool.query('BEGIN');
    
    // 1. Update Masterlist
    await pool.query('UPDATE third_level_officials_masterlist SET email = $1, updated_at = NOW() WHERE tlid = $2', [newEmail, tlid]);
    
    // 2. Append to Updates Ledger
    await pool.query(`
      INSERT INTO third_level_officials_updates (
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2, status, 
        change_type, updated_by
      )
      SELECT 
        tlid, sort_index, strand, office, name, position, 
        email, alt_email_1, alt_email_2, contact_details, 
        alt_contact_details_1, alt_contact_details_2, status, 
        'INFO_UPDATE_TEST', 'TEST_RUNNER'
      FROM third_level_officials_masterlist WHERE tlid = $1
    `, [tlid]);
    
    await pool.query('COMMIT');
    
    console.log('Update logic executed successfully.');
    
    const res = await pool.query('SELECT * FROM third_level_officials_updates WHERE tlid = $1 ORDER BY created_at DESC', [tlid]);
    console.log('Ledger History for', tlid, ':', res.rows.map(r => ({ type: r.change_type, email: r.email, date: r.created_at })));
    
  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    await pool.end();
  }
}

testUpdate();
