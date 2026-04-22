const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function diag() {
  const client = await pool.connect();
  try {
    const efQuery = `
      SELECT *
      FROM engineer_form e
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = e.ipc)
      AND e.project_category = 'New Construction'
      LIMIT 1000
    `;
    const efRows = await client.query(efQuery);
    console.log(`Analyzing ${efRows.rows.length} non-matching EF projects...`);

    let schoolMatches = 0;
    let schoolYearMatches = 0;
    let schoolYearCatMatches = 0;
    let schoolYearCatBudgetMatches = 0;

    for (const ef of efRows.rows) {
      // Check School
      const schoolRes = await client.query(`SELECT 1 FROM import_beff_projects WHERE school_id::text = $1`, [String(ef.school_id)]);
      if (schoolRes.rows.length > 0) schoolMatches++;

      // Check School + Year
      const yearRes = await client.query(`SELECT 1 FROM import_beff_projects WHERE school_id::text = $1 AND funding_year::text = $2`, [String(ef.school_id), String(ef.funding_year)]);
      if (yearRes.rows.length > 0) schoolYearMatches++;

      // Check School + Year + Cat
      const catRes = await client.query(`SELECT 1 FROM import_beff_projects WHERE school_id::text = $1 AND funding_year::text = $2 AND (project_category = 'NC' OR project_category = 'New Construction')`, [String(ef.school_id), String(ef.funding_year)]);
      if (catRes.rows.length > 0) schoolYearCatMatches++;

      // Check School + Year + Cat + Budget
      const budgetRes = await client.query(`SELECT 1 FROM import_beff_projects WHERE school_id::text = $1 AND funding_year::text = $2 AND (project_category = 'NC' OR project_category = 'New Construction') AND ABS(COALESCE(approved_budget_for_contract, 0) - $3) < 1`, [String(ef.school_id), String(ef.funding_year), Number(ef.approved_budget_for_contract)]);
      if (budgetRes.rows.length > 0) schoolYearCatBudgetMatches++;
    }

    console.log(`School matches: ${schoolMatches}`);
    console.log(`School+Year matches: ${schoolYearMatches}`);
    console.log(`School+Year+Cat matches: ${schoolYearCatMatches}`);
    console.log(`School+Year+Cat+Budget matches: ${schoolYearCatBudgetMatches}`);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

diag();
