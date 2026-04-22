const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Forensic Data Consistency Audit ---");
    
    // 1. Current DB and Table Stats
    const statsRes = await client.query(`
      SELECT 
        current_database() as db,
        (SELECT COUNT(*) FROM import_beff_projects) as total_count,
        (SELECT COUNT(*) FROM import_beff_projects WHERE project_category = 'New Construction') as nc_count,
        (SELECT COUNT(*) FROM import_beff_projects WHERE project_category = 'BEFF') as beff_count,
        (SELECT COUNT(*) FROM import_beff_projects WHERE project_category = 'NC') as nc_short_count
    `);
    console.table(statsRes.rows);

    // 2. Check for Row Level Security (RLS)
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'import_beff_projects'
    `);
    console.log("\nRLS Enabled:");
    console.table(rlsRes.rows);

    if (rlsRes.rows[0].relrowsecurity) {
      const polRes = await client.query(`
        SELECT policyname, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'import_beff_projects'
      `);
      console.log("\nActive Policies:");
      console.table(polRes.rows);
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
