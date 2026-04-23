const { Pool } = require('pg');

const API_BASE = 'http://localhost:5174/api';
const DB_URL = 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyPersistenceFix() {
  try {
    console.log(`Fetching latest projects to verify persistence...`);
    const projRes = await fetch(`${API_BASE}/projects?limit=10`);
    const projData = await projRes.json();
    const project = projData.data[0];
    
    if (!project) {
        console.error("No projects found!");
        return;
    }

    console.log(`Project: ${project.projectName} (ID: ${project.id})`);
    console.log(`API Response -> status: ${project.status}`);
    console.log(`API Response -> procurement_status: ${project.procurement_status}`);

    // Verify against DB directly
    const dbRes = await pool.query('SELECT status_of_construction_phase, procurement_status FROM engineer_form WHERE project_id = $1', [project.id]);
    const dbRow = dbRes.rows[0];
    console.log(`DB Values -> status_of_construction_phase: ${dbRow.status_of_construction_phase}`);
    console.log(`DB Values -> procurement_status: ${dbRow.procurement_status}`);

    if (project.status === dbRow.status_of_construction_phase && project.procurement_status === dbRow.procurement_status) {
        console.log("✅ VERIFIED: API response correctly reflects database values.");
    } else {
        console.error("❌ FAILED: API response does not match database.");
    }

  } catch (err) {
    console.log("❌ Execution Error:", err.message);
  } finally {
    await pool.end();
  }
}

verifyPersistenceFix();
