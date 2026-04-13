const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function investigate() {
  try {
    // Issue 1: 100% projects without photos
    console.log("=== ISSUE 1: 100% Projects without Photos ===");
    const missingPhotosQ = await pool.query(`
      SELECT e.project_id, e.project_name, e.accomplishment_percentage
      FROM engineer_form e
      LEFT JOIN engineer_image i ON e.project_id = i.project_id
      WHERE e.accomplishment_percentage = '100' AND i.project_id IS NULL
      LIMIT 5;
    `);
    
    const countMissingPhotosQ = await pool.query(`
      SELECT COUNT(*) 
      FROM engineer_form e
      LEFT JOIN engineer_image i ON e.project_id = i.project_id
      WHERE e.accomplishment_percentage = '100' AND i.project_id IS NULL;
    `);
    console.log(`Found ${countMissingPhotosQ.rows[0].count} projects at 100% but NO photos.`);
    console.table(missingPhotosQ.rows);
    
    // Check if these missing photos might be stranded in engineer_form_archive? 
    // Wait, the archiving script moved the photos to the survivor ID. Let's see if the survivor IDs have photos in the archive... well, engineer_image just has project_id.
    
    // Issue 2: Find duplicates with NULL created_at and their IPCs
    console.log("\n=== ISSUE 2: Projects with NULL created_at ===");
    const nullCreatedAtQ = await pool.query(`
      SELECT COUNT(*) FROM engineer_form WHERE created_at IS NULL;
    `);
    console.log(`Projects with NULL created_at: ${nullCreatedAtQ.rows[0].count}`);
    
    const recentNullCreatedAtQ = await pool.query(`
      SELECT project_id, project_name, ipc, created_at 
      FROM engineer_form 
      WHERE created_at IS NULL 
      ORDER BY project_id DESC LIMIT 5;
    `);
    console.table(recentNullCreatedAtQ.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

investigate();
