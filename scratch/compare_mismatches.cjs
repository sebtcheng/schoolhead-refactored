'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const fs = require('fs');

async function run() {
  const client = await pool.connect();
  let output = "";
  try {
    output += "\n" + "=".repeat(60) + "\n";
    output += "      MISMATCHED IPC ANALYSIS: IMPORT BEFF VS ENGINEER FORMS\n";
    output += "=".repeat(60) + "\n";

    // 1. Get Columns of engineer_form
    const efColsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'engineer_form'
    `);
    const efCols = efColsRes.rows.map(r => r.column_name);
    output += `Engineer Form Columns: ${efCols.join(', ')}\n\n`;

    // Identified equivalent columns (tentative based on usual naming):
    // funding_year, school_id, project_category
    // For approved_budget_for_contract, let's look at the list.
    const budgetCol = efCols.find(c => c.includes('budget') || c === 'abc') || 'approved_budget_for_contract';
    output += `Using budget column: ${budgetCol}\n\n`;

    // 2. Find IPCs in import_beff_projects not in engineer_form
    const mismatchCountRes = await client.query(`
      SELECT COUNT(DISTINCT i.ipc)
      FROM import_beff_projects i
      LEFT JOIN engineer_form e ON i.ipc = e.ipc
      WHERE e.ipc IS NULL AND i.ipc IS NOT NULL AND i.ipc != ''
    `);
    const mismatchCount = parseInt(mismatchCountRes.rows[0].count, 10);
    output += `Unique IPCs in Import BEFF NOT in Engineer Forms: ${mismatchCount.toLocaleString()}\n`;

    if (mismatchCount > 0) {
      // 3. Find matches for these mismatched IPCs based on metadata
      // Criteria: funding_year, approved_budget_for_contract, school_id, project_category
      const metaMatchRes = await client.query(`
        WITH MismatchedIPCs AS (
          SELECT DISTINCT i.ipc, i.funding_year, i.approved_budget_for_contract, i.school_id, i.project_category, i.school_name, i.project_name
          FROM import_beff_projects i
          LEFT JOIN engineer_form e ON i.ipc = e.ipc
          WHERE e.ipc IS NULL AND i.ipc IS NOT NULL AND i.ipc != ''
        )
        SELECT 
          m.ipc as import_ipc,
          e.ipc as ef_ipc,
          m.school_name as import_school,
          e.school_name as ef_school,
          m.project_name as import_project,
          e.project_name as ef_project
        FROM MismatchedIPCs m
        INNER JOIN engineer_form e ON 
          m.funding_year = e.funding_year AND 
          m.approved_budget_for_contract = e.${budgetCol} AND 
          m.school_id::text = e.school_id::text AND 
          m.project_category = e.project_category
      `);
      
      const metaMatchCount = metaMatchRes.rows.length;
      output += `Projects matching on Year, Budget, School ID, and Category: ${metaMatchCount.toLocaleString()}\n`;

      if (metaMatchCount > 0) {
        output += `\n[META-MATCH SAMPLES]\n`;
        metaMatchRes.rows.slice(0, 5).forEach(r => {
          output += `Import IPC: ${r.import_ipc} | EF IPC: ${r.ef_ipc}\n`;
          output += `  School: ${r.import_school} (Import) / ${r.ef_school} (EF)\n`;
          output += `  Project: ${r.import_project} (Import) / ${r.ef_project} (EF)\n\n`;
        });
      }
    }

    output += "=".repeat(60) + "\n";
    console.log(output);
    fs.writeFileSync(require('path').join(__dirname, 'mismatch_result.txt'), output);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    fs.writeFileSync(require('path').join(__dirname, 'mismatch_result.txt'), `Error: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
