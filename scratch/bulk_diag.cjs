const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diag() {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        COUNT(*) as total_non_ipc_matches,
        COUNT(CASE WHEN i1.school_id IS NOT NULL THEN 1 END) as school_id_matches,
        COUNT(CASE WHEN i2.school_id IS NOT NULL THEN 1 END) as school_id_year_matches,
        COUNT(CASE WHEN i3.school_id IS NOT NULL THEN 1 END) as school_id_year_cat_matches,
        COUNT(CASE WHEN i4.school_id IS NOT NULL THEN 1 END) as final_matches
      FROM engineer_form e
      LEFT JOIN import_beff_projects i1 ON e.school_id::text = i1.school_id::text
      LEFT JOIN import_beff_projects i2 ON e.school_id::text = i2.school_id::text AND e.funding_year::text = i2.funding_year::text
      LEFT JOIN import_beff_projects i3 ON e.school_id::text = i3.school_id::text AND e.funding_year::text = i3.funding_year::text 
         AND (i3.project_category = 'NC' OR i3.project_category = 'New Construction')
      LEFT JOIN import_beff_projects i4 ON e.school_id::text = i4.school_id::text AND e.funding_year::text = i4.funding_year::text 
         AND (i4.project_category = 'NC' OR i4.project_category = 'New Construction')
         AND ABS(COALESCE(i4.approved_budget_for_contract, 0) - COALESCE(e.approved_budget_for_contract, 0)) < 1
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i0 WHERE i0.ipc = e.ipc)
      AND e.project_category = 'New Construction'
    `;
    
    const res = await client.query(query);
    console.table(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

diag();
