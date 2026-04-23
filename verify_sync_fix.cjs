const { Pool } = require('pg');

const API_BASE = 'http://localhost:5174/api';
const DB_URL = 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifySyncFix() {
  try {
    const TEST_IPC = 'INF-12-2026-00819';
    console.log(`Fetching project ${TEST_IPC} to update...`);
    const projRes = await fetch(`${API_BASE}/projects?ipc=${TEST_IPC}`);
    const projData = await projRes.json();
    
    // Find exact match
    const project = projData.data.find(p => p.ipc === TEST_IPC);
    
    if (!project) {
        console.error("Project not found!");
        return;
    }
    console.log(`Initial Construction Status (status_of_construction_phase): ${project.status_of_construction_phase || 'None'}`);
    console.log(`Initial Legacy Status (status): ${project.status || 'None'}`);

    console.log("Sending PUT request for CONSTRUCTION update to 'Ongoing'...");
    
    const payload = {
      uid: 'SYSTEM_VERIFY',
      modifiedBy: 'Antigravity Verification',
      id: project.id,
      status: 'Ongoing', // Construction change
      otherRemarks: 'Verification Status Sync Test'
    };

    const res = await fetch(`${API_BASE}/update-project/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      console.log("✅ API Update Successful!");
      const resData = await res.json();
      const newProject = resData.project || resData.data?.project || resData.data || {};
      
      console.log("New status_of_construction_phase:", newProject.status_of_construction_phase);
      console.log("New legacy status:", newProject.status);
      
      if (newProject.status_of_construction_phase === 'Ongoing' && newProject.status === 'Ongoing') {
          console.log("✅ VERIFIED: Both columns are synced to 'Ongoing'.");
      } else {
          console.error("❌ FAILED: Columns are NOT synced correctly.");
      }

      // Check logs
      console.log("Checking Activity Logs...");
      const logRes = await pool.query('SELECT * FROM activity_logs WHERE details LIKE $1 ORDER BY timestamp DESC LIMIT 1', [`%${project.project_name}%`]);
      const lastLog = logRes.rows[0];
      if (lastLog) {
          const logDetails = JSON.parse(lastLog.details);
          console.log("Last Log Changes:", logDetails.changes);
          const constructionChange = logDetails.changes.filter(c => c.includes("Construction Status"));
          if (constructionChange.length > 0) {
              console.log("✅ VERIFIED: Construction Status change WAS logged.");
          } else {
              console.error("❌ FAILED: Construction Status change was NOT logged.");
          }
      }
    } else {
      const errData = await res.json();
      console.log("❌ API Update Failed!", res.status, errData);
    }
  } catch (err) {
    console.log("❌ Verification Script Error:", err.message);
  } finally {
    await pool.end();
  }
}

verifySyncFix();
