const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    console.log("=== ALTERNATIVE MATCH AUDIT ===");

    // How many of the 9372 orphans can be matched via alternative criteria?
    const altMatch = await client.query(`
      SELECT count(DISTINCT e.project_id)
      FROM engineer_form e
      JOIN import_beff_projects i ON (
        e.school_id::text = i.school_id::text
        AND e.funding_year::text = i.funding_year::text
        AND e.abc::text = i.abc::text
        AND i.project_category ILIKE '%New Con%'
      )
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects x WHERE x.ipc = e.ipc)
    `);
    console.log(`Alt-matched orphans (school+year+abc+category): ${altMatch.rows[0].count}`);

    // Breakdown: truly unmatched by anything
    const trulyUnmatched = await client.query(`
      SELECT count(DISTINCT e.project_id)
      FROM engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects x WHERE x.ipc = e.ipc)
      AND NOT EXISTS (
        SELECT 1 FROM import_beff_projects i
        WHERE e.school_id = i.school_id
        AND e.funding_year = i.funding_year
        AND ROUND(e.abc::numeric, 2) = ROUND(i.abc::numeric, 2)
        AND i.project_category ILIKE '%New Con%'
      )
    `);
    console.log(`Truly unmatched (no IPC, no alt-match)        : ${trulyUnmatched.rows[0].count}`);

    // Sample the alt-matched ones to verify quality
    console.log("\nSample alt-matches (IPC mismatch but attributes match):");
    const sample = await client.query(`
      SELECT e.ipc as ef_ipc, i.ipc as beff_ipc, e.school_id, e.funding_year, e.abc
      FROM engineer_form e
      JOIN import_beff_projects i ON (
        e.school_id = i.school_id
        AND e.funding_year = i.funding_year
        AND ROUND(e.abc::numeric, 2) = ROUND(i.abc::numeric, 2)
        AND i.project_category ILIKE '%New Con%'
      )
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM import_beff_projects x WHERE x.ipc = e.ipc)
      LIMIT 10
    `);
    sample.rows.forEach(r =>
      console.log(`  EF IPC: ${r.ef_ipc} | BEFF IPC: ${r.beff_ipc} | school: ${r.school_id} | year: ${r.funding_year} | abc: ${r.abc}`)
    );

  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
