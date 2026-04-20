'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const client = await pool.connect();
  try {
     // Identify equivalent columns in engineer_form
    const efColsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
    const efCols = efColsRes.rows.map(r => r.column_name);
    const budgetCol = efCols.find(c => c.includes('budget') || c === 'abc') || 'approved_budget_for_contract';

    const metaMatchQuery = `
        WITH MismatchedIPCs AS (
          SELECT DISTINCT i.ipc as import_ipc, i.funding_year, i.approved_budget_for_contract, i.school_id, i.project_category
          FROM import_beff_projects i
          LEFT JOIN engineer_form e ON i.ipc = e.ipc
          WHERE e.ipc IS NULL AND i.ipc IS NOT NULL AND i.ipc != ''
        )
        SELECT 
          m.import_ipc as new_ipc,
          e.ipc as old_ipc
        FROM MismatchedIPCs m
        INNER JOIN engineer_form e ON 
          m.funding_year = e.funding_year AND 
          m.approved_budget_for_contract = e.${budgetCol} AND 
          m.school_id::text = e.school_id::text AND 
          m.project_category = e.project_category
    `;

    const res = await client.query(metaMatchQuery);
    console.log(`Identified ${res.rows.length} mappings.`);
    
    fs.writeFileSync(require('path').join(__dirname, 'ipc_mapping.json'), JSON.stringify(res.rows, null, 2));
    console.log("Mapping saved to scratch/ipc_mapping.json");

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
