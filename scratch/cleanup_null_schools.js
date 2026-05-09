import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });

async function performDeletion() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Authorize deletion for this session (Master Tinkerer & Legacy Bypass)
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
    await client.query("SET LOCAL app.allow_deletions = 'true'");
    
    // 2. Perform deletion based on specific user-authorized criteria
    const res = await client.query(`
        DELETE FROM ph_schools 
        WHERE province IS NULL 
          AND municipality IS NULL 
          AND barangay IS NULL 
          AND district IS NULL
    `);
    
    console.log(`✅ Successfully deleted ${res.rowCount} corrupted/test records from ph_schools.`);
    
    await client.query('COMMIT');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Deletion failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

performDeletion();
