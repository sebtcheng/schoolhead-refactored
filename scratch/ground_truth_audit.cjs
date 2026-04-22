const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const beff_total = await client.query("SELECT count(*) FROM public.import_beff_projects");
    const beff_cats  = await client.query("SELECT project_category, count(*) FROM public.import_beff_projects GROUP BY project_category ORDER BY count DESC");
    const ef_nc      = await client.query("SELECT count(*) FROM public.engineer_form WHERE project_category ILIKE '%New Con%'");
    const ef_nc_unique = await client.query("SELECT count(DISTINCT ipc) FROM public.engineer_form WHERE project_category ILIKE '%New Con%'");
    const orphans    = await client.query(`
      SELECT count(*) FROM public.engineer_form e
      WHERE e.project_category ILIKE '%New Con%'
      AND NOT EXISTS (SELECT 1 FROM public.import_beff_projects i WHERE i.ipc = e.ipc)
    `);

    console.log("=== GROUND TRUTH AUDIT ===");
    console.log(`import_beff_projects total rows : ${beff_total.rows[0].count}`);
    console.log(`engineer_form NC rows            : ${ef_nc.rows[0].count}`);
    console.log(`engineer_form NC unique IPCs     : ${ef_nc_unique.rows[0].count}`);
    console.log(`NC orphans (not in beff)         : ${orphans.rows[0].count}`);
    console.log("\nimport_beff_projects categories:");
    beff_cats.rows.forEach(r => console.log(`  [${r.project_category}] : ${r.count}`));
  } catch(e) {
    console.error(e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
