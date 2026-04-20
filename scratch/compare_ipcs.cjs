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
    output += "      IPC COMPARISON: ENGINEER FORMS VS BEFF TABLES\n";
    output += "=".repeat(60) + "\n";

    // 1. Total IPCs in engineer_form
    const efRes = await client.query("SELECT COUNT(DISTINCT ipc) FROM engineer_form WHERE ipc IS NOT NULL AND ipc != ''");
    const efCount = parseInt(efRes.rows[0].count, 10);

    // 2. Total IPCs in engineer_imported_beff
    const beffRes = await client.query("SELECT COUNT(DISTINCT ipc) FROM engineer_imported_beff WHERE ipc IS NOT NULL AND ipc != ''");
    const beffCount = parseInt(beffRes.rows[0].count, 10);

    // 3. Common IPCs
    const commonRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      JOIN engineer_imported_beff b ON e.ipc = b.ipc
      WHERE e.ipc IS NOT NULL AND e.ipc != ''
    `);
    const commonCount = parseInt(commonRes.rows[0].count, 10);

    // 4. Sample IPCs
    const efSamples = await client.query("SELECT ipc FROM engineer_form WHERE ipc IS NOT NULL AND ipc != '' LIMIT 5");
    const beffSamples = await client.query("SELECT ipc FROM engineer_imported_beff WHERE ipc IS NOT NULL AND ipc != '' LIMIT 5");

    output += `\n[REPORT]\n`;
    output += `Total Unique IPCs in Engineer Forms      : ${efCount.toLocaleString()}\n`;
    output += `Total Unique IPCs in Imported BEFF Tables : ${beffCount.toLocaleString()}\n`;
    output += `Common Unique IPCs                       : ${commonCount.toLocaleString()}\n`;

    output += `\n[SAMPLES]\n`;
    output += `Engineer Form IPCs: ${efSamples.rows.map(r => r.ipc).join(', ')}\n`;
    output += `BEFF IPCs         : ${beffSamples.rows.map(r => r.ipc).join(', ')}\n`;

    // 8. Check for school_id + suffix overlap
    const schoolRes = await client.query(`
      SELECT COUNT(*)
      FROM engineer_form e
      JOIN engineer_imported_beff b ON e.school_id::text = b.school_id::text 
        AND SUBSTRING(e.ipc FROM 'INF-[^-]+-(.*)') = SUBSTRING(b.ipc FROM 'INF-[^-]+-(.*)')
      WHERE e.ipc IS NOT NULL AND e.ipc != ''
        AND b.ipc IS NOT NULL AND b.ipc != ''
    `);
    const schoolCount = parseInt(schoolRes.rows[0].count, 10);
    output += `Matches on School ID + IPC Suffix           : ${schoolCount.toLocaleString()}\n`;

    // 9. Sample school_id matches
    if (schoolCount > 0) {
      const schoolMatchesRes = await client.query(`
        SELECT 
          e.ipc as ef_ipc, 
          b.ipc as beff_ipc, 
          e.school_name as ef_school, 
          b.school_name as beff_school,
          e.project_name as ef_project,
          b.project_name as beff_project
        FROM engineer_form e
        JOIN engineer_imported_beff b ON e.school_id::text = b.school_id::text 
          AND SUBSTRING(e.ipc FROM 'INF-[^-]+-(.*)') = SUBSTRING(b.ipc FROM 'INF-[^-]+-(.*)')
        WHERE e.ipc IS NOT NULL AND e.ipc != ''
          AND b.ipc IS NOT NULL AND b.ipc != ''
        LIMIT 3
      `);

      output += `\n[SCHOOL_ID + SUFFIX MATCH SAMPLES]\n`;
      schoolMatchesRes.rows.forEach(r => {
        output += `EF  : ${r.ef_ipc} | ${r.ef_school} | ${r.ef_project}\n`;
        output += `BEFF: ${r.beff_ipc} | ${r.beff_school} | ${r.beff_project}\n\n`;
      });
    }

    if (efCount > 0) {
      const overlapPct = (commonCount / efCount) * 100;
      output += `Overlap (Common / Engineer Forms)        : ${overlapPct.toFixed(2)}%\n`;
    }

    output += "=".repeat(60) + "\n";
    console.log(output);
    fs.writeFileSync(require('path').join(__dirname, 'compare_result.txt'), output);

    // 10. Analyze import_beff_projects identifiers
    const importMeta = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'import_beff_projects'
    `);
    const importColNames = importMeta.rows.map(r => r.column_name);

    output += `\n[IMPORT_BEFF_PROJECTS ANALYSIS]\n`;
    output += `Columns: ${importColNames.join(', ')}\n`;

    // 11. Direct IPC comparison between engineer_form and import_beff_projects
    const directMatchRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.ipc IS NOT NULL AND e.ipc != ''
    `);
    const directMatchCount = parseInt(directMatchRes.rows[0].count, 10);
    output += `\n[IMPORT_BEFF_PROJECTS DIRECT IPC MATCH]\n`;
    output += `Common Unique IPCs (Direct Match): ${directMatchCount.toLocaleString()}\n`;

    if (directMatchCount > 0) {
      const sampleMatch = await client.query(`
        SELECT 
          e.ipc, 
          e.school_name as ef_school, 
          i.school_name as import_school,
          e.project_name as ef_project,
          i.project_name as import_project
        FROM engineer_form e
        JOIN import_beff_projects i ON e.ipc = i.ipc
        LIMIT 3
      `);
      output += `\n[DIRECT MATCH SAMPLES]\n`;
      sampleMatch.rows.forEach(r => {
        output += `IPC: ${r.ipc}\n`;
        output += `  EF    : ${r.ef_school} | ${r.ef_project}\n`;
        output += `  IMPORT: ${r.import_school} | ${r.import_project}\n\n`;
      });
    }

    output += "=".repeat(60) + "\n";
    console.log(output);
    fs.writeFileSync(require('path').join(__dirname, 'compare_result.txt'), output);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    fs.writeFileSync(require('path').join(__dirname, 'compare_result.txt'), `Error: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
