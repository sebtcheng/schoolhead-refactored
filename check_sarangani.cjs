const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkProjects() {
  try {
    // Check for distinct divisions to see formatting
    const divRes = await pool.query("SELECT DISTINCT division FROM engineer_form WHERE region ILIKE '%XII%' LIMIT 10");
    console.log("Divisions in REGION XII:", JSON.stringify(divRes.rows, null, 2));

    // Check for projects in Sarangani
    const projRes = await pool.query("SELECT project_id, school_name, division, region FROM engineer_form WHERE division ILIKE '%SARANGANI%' LIMIT 5");
    console.log("Sample Sarangani Projects:", JSON.stringify(projRes.rows, null, 2));
    
    const countRes = await pool.query("SELECT COUNT(*) FROM engineer_form WHERE division ILIKE '%SARANGANI%'");
    console.log("Total Sarangani Projects:", countRes.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkProjects();
