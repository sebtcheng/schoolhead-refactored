const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function findMapping() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'import_beff_projects'
    `);
    const cols = res.rows.map(r => r.column_name);
    console.log("import_beff_projects Columns:", cols);

    // Specifically look for matches for: school_id, funding_year, project_category, approved_budget_for_contract
    const targets = ['school', 'year', 'category', 'budget', 'abc', 'contract'];
    const matches = cols.filter(c => targets.some(t => c.toLowerCase().includes(t)));
    console.log("\nPotential matching columns in import_beff_projects:", matches);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

findMapping();
