const { Pool } = require('pg');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const DATABASE_URL = 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';
const API_URL = 'http://localhost:5174/api/update-project';

async function verify() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  try {
    // 1. Get a project ID
    console.log("Fetching project to update...");
    const res = await pool.query('SELECT project_id, project_name, ipc FROM engineer_form ORDER BY project_id DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log("No projects found to test.");
      return;
    }
    const project = res.rows[0];
    console.log(`Found project: ${project.project_name} (ID: ${project.project_id})`);

    // 2. Mock a PUT request
    console.log("Sending PUT request...");
    const payload = {
      ...project,
      procurement_status: 'Under procurement',
      statusDesignPhase: 'Under procurement',
      update_type: 'Status Quick Update',
      uid: 'test-uid'
    };

    const response = await fetch(`${API_URL}/${project.project_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (response.ok) {
      console.log("✅ API Update Successful!");
      console.log("New Project Data:", result.project);
      
      // 3. Verify in DB
      const verifyRes = await pool.query('SELECT * FROM engineer_form WHERE project_id = $1', [result.project.project_id]);
      if (verifyRes.rows.length > 0) {
        console.log("✅ Verified in DB: New row created successfully.");
      } else {
        console.log("❌ DB Verification Failed: New row not found.");
      }
    } else {
      console.log("❌ API Update Failed!");
      console.log("Error:", result);
    }

  } catch (err) {
    console.error("Verification Error:", err);
  } finally {
    await pool.end();
  }
}

verify();
