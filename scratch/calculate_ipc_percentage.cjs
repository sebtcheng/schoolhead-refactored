const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function calculatePercentage() {
  const client = await pool.connect();
  try {
    const totalNewConstructionRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    const totalNewConstruction = parseInt(totalNewConstructionRes.rows[0].count, 10);

    const matchingNewConstructionRes = await client.query(`
      SELECT COUNT(DISTINCT e.ipc)
      FROM engineer_form e
      INNER JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category = 'New Construction'
    `);
    const matchingNewConstruction = parseInt(matchingNewConstructionRes.rows[0].count, 10);

    const percentage = (matchingNewConstruction / totalNewConstruction) * 100;

    console.log(JSON.stringify({
      total_new_construction: totalNewConstruction,
      matching_new_construction: matchingNewConstruction,
      percentage: percentage.toFixed(2) + "%"
    }, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

calculatePercentage();
