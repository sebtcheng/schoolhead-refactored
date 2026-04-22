const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function compareData() {
  const client = await pool.connect();
  try {
    // Get one non-matching NC project from engineer_form
    const efRow = await client.query(`
      SELECT ipc, school_id, funding_year, project_category, approved_budget_for_contract, school_name
      FROM engineer_form
      WHERE NOT EXISTS (SELECT 1 FROM import_beff_projects i WHERE i.ipc = engineer_form.ipc)
      AND project_category = 'New Construction'
      LIMIT 1
    `);
    
    if (efRow.rows.length === 0) {
      console.log("No non-matching projects found in engineer_form.");
      return;
    }

    const ef = efRow.rows[0];
    console.log("EF Sample:", ef);

    // Find any NC projects for this school in import_beff_projects
    // Using loose join (school_id only)
    const importRows = await client.query(`
      SELECT ipc, school_id, funding_year, project_category, approved_budget_for_contract, school_name
      FROM import_beff_projects
      WHERE school_id::text = $1
    `, [String(ef.school_id)]);

    console.log("\nPotential matches in import_beff_projects:");
    importRows.rows.forEach((row, i) => {
      console.log(`Match ${i+1}:`);
      console.log("  IPC:", row.ipc);
      console.log("  Funding Year:", row.funding_year, `(EF: ${ef.funding_year})`);
      console.log("  Category:", row.project_category, `(EF: ${ef.project_category})`);
      console.log("  Budget:", row.approved_budget_for_contract, `(EF: ${ef.approved_budget_for_contract})`);
      
      const yearMatch = String(row.funding_year) === String(ef.funding_year);
      const catMatch = (row.project_category === 'NC' && ef.project_category === 'New Construction') || (row.project_category === ef.project_category);
      const budgetMatch = Math.abs(Number(row.approved_budget_for_contract) - Number(ef.approved_budget_for_contract)) < 0.01;
      
      console.log(`  Results: Year=${yearMatch}, Cat=${catMatch}, Budget=${budgetMatch}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

compareData();
