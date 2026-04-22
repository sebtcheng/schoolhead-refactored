const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("--- Identifying 'New Construction' Categories ---");
    const catRes = await client.query(`
      SELECT project_category, COUNT(*) as count 
      FROM engineer_form 
      WHERE project_category IS NOT NULL
      GROUP BY project_category 
      ORDER BY count DESC
      LIMIT 100
    `);
    
    const constructionCats = catRes.rows
      .filter(r => r.project_category.toLowerCase().includes('construction'))
      .map(r => r.project_category);
    
    console.log("Top Construction-related Categories:", constructionCats);

    if (constructionCats.length === 0) {
      console.log("No categories found with 'construction' in the name. Checking 'new'...");
      const newCats = catRes.rows
        .filter(r => r.project_category.toLowerCase().includes('new'))
        .map(r => r.project_category);
      console.log("Top 'New'-related Categories:", newCats);
    }

    // Usually "New Construction" or similar. Let's assume the user means "New Construction" specifically if it exists.
    // However, I will join on IPC and filter by category for ALL matches found.
    
    console.log("\n--- Joining on IPC and Filtering ---");
    // We want IPCs that are in BOTH tables.
    const query = `
      SELECT 
        e.ipc, 
        e.project_name as ef_project, 
        i.project_name as import_project,
        e.project_category as ef_category,
        e.school_id,
        e.school_name
      FROM engineer_form e
      INNER JOIN import_beff_projects i ON e.ipc = i.ipc
      WHERE e.project_category ILIKE '%construction%' 
         OR e.project_category ILIKE '%new%'
    `;

    const matchesRes = await client.query(query);
    console.log(`Total Matches Found: ${matchesRes.rows.length}`);

    // Group by category to see the breakdown of matching IPCs
    const stats = {};
    matchesRes.rows.forEach(r => {
      stats[r.ef_category] = (stats[r.ef_category] || 0) + 1;
    });
    console.log("Breakdown by Category:", stats);

    // Save detailed results to a file
    const fs = require('fs');
    fs.writeFileSync('scratch/ipc_matches_details.json', JSON.stringify(matchesRes.rows, null, 2));
    console.log("Detailed results saved to scratch/ipc_matches_details.json");

  } catch (err) {
    console.error("Execution Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
