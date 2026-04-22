const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verifyCounts() {
  const client = await pool.connect();
  try {
    const totalCountRes = await client.query(`SELECT COUNT(*) FROM engineer_form`);
    console.log("Total projects in engineer_form:", totalCountRes.rows[0].count);

    const newConstructionCountRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    console.log("Total 'New Construction' projects (Exact Match):", newConstructionCountRes.rows[0].count);

    const constructionLikeCountRes = await client.query(`
      SELECT COUNT(*) 
      FROM engineer_form 
      WHERE project_category ILIKE '%New Construction%'
    `);
    console.log("Total 'New Construction' projects (ILIKE):", constructionLikeCountRes.rows[0].count);

    const uniqueIPCRes = await client.query(`
      SELECT COUNT(DISTINCT ipc) 
      FROM engineer_form 
      WHERE project_category = 'New Construction'
    `);
    console.log("Unique IPCs in 'New Construction':", uniqueIPCRes.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyCounts();
