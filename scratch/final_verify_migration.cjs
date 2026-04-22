const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verify() {
  const client = await pool.connect();
  try {
    console.log("--- FINAL MIGRATION VERIFICATION ---");
    
    const res = await client.query(`
      SELECT 
        COUNT(*) as total_nc,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc) THEN 1 ELSE 0 END) as matched_ipcs,
        SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc) THEN 1 ELSE 0 END) as remaining_non_matches
      FROM engineer_form e
      WHERE e.project_category = 'New Construction'
    `);
    
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

verify();
