const { Pool } = require('pg');

const API_BASE = 'http://localhost:5174/api';
const DB_URL = 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyFinalFix() {
  try {
    // Let's find ANY project to test with
    console.log(`Fetching latest projects to find a test candidate...`);
    const projRes = await fetch(`${API_BASE}/projects?limit=10`);
    const projData = await projRes.json();
    const project = projData.data[0];
    
    if (!project) {
        console.error("No projects found!");
        return;
    }
    const TEST_IPC = project.ipc;
    console.log(`Using project: ${project.project_name} (${TEST_IPC}, ID: ${project.id})`);
    const initialProc = project.procurement_status;
    const initialConst = project.status_of_construction_phase;
    console.log(`Initial Status: Procurement=${initialProc || 'None'}, Construction=${initialConst || 'None'}`);

    // Test 1: Procurement Update
    console.log("\n--- TEST 1: PROCUREMENT UPDATE ---");
    const payloadProc = {
      uid: 'SYSTEM_VERIFY',
      modifiedBy: 'Antigravity FINAL',
      id: project.id,
      procurement_status: 'Completed',
      statusDesignPhase: 'Completed',
      otherRemarks: 'Verification FINAL - Procurement'
    };

    const res1 = await fetch(`${API_BASE}/update-project/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadProc)
    });
    
    if (res1.ok) {
        const data1 = await res1.json();
        const updated1 = data1.project || data1.data?.project || data1.data || {};
        console.log("✅ Procurement Update Success!");
        console.log("Updated Procurement Status:", updated1.procurement_status);
        console.log("Preserved Construction Status:", updated1.status_of_construction_phase);
        
        // Log check
        const logRes1 = await pool.query('SELECT * FROM activity_logs WHERE details LIKE $1 ORDER BY timestamp DESC LIMIT 1', [`%Verification FINAL - Procurement%`]);
        if (logRes1.rows[0]) {
            const changes = JSON.parse(logRes1.rows[0].details).changes;
            console.log("Logged Changes:", changes);
            const constructionLogged = changes.some(c => c.includes("Construction Status"));
            if (!constructionLogged) {
                console.log("✅ VERIFIED: Construction Status NOT logged during Procurement update.");
            } else {
                console.error("❌ FAILED: Construction Status WAS logged.");
            }
        }
    } else {
        const err1 = await res1.json().catch(() => ({ error: 'Unknown' }));
        console.error("❌ Procurement Update failed with status", res1.status, err1);
    }

    // Test 2: Construction Update
    console.log("\n--- TEST 2: CONSTRUCTION UPDATE ---");
    const payloadConst = {
      uid: 'SYSTEM_VERIFY',
      modifiedBy: 'Antigravity FINAL',
      id: project.id,
      status: 'Ongoing', // Construction status dropdown sends 'status'
      otherRemarks: 'Verification FINAL - Construction'
    };

    const res2 = await fetch(`${API_BASE}/update-project/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadConst)
    });
    
    if (res2.ok) {
        const data2 = await res2.json();
        const updated2 = data2.project || data2.data?.project || data2.data || {};
        console.log("✅ Construction Update Success!");
        console.log("Updated Construction Status:", updated2.status_of_construction_phase);
        
        // Log check
        const logRes2 = await pool.query('SELECT * FROM activity_logs WHERE details LIKE $1 ORDER BY timestamp DESC LIMIT 1', [`%Verification FINAL - Construction%`]);
        if (logRes2.rows[0]) {
            const changes = JSON.parse(logRes2.rows[0].details).changes;
            console.log("Logged Changes:", changes);
            const constructionLogged = changes.some(c => c.includes("Construction Status"));
            if (constructionLogged) {
                console.log("✅ VERIFIED: Construction Status WAS correctly logged.");
            } else {
                console.error("❌ FAILED: Construction Status change was NOT logged.");
            }
        }
    } else {
        const err2 = await res2.json().catch(() => ({ error: 'Unknown' }));
        console.error("❌ Construction Update failed with status", res2.status, err2);
    }

  } catch (err) {
    console.log("❌ Execution Error:", err.message);
  } finally {
    await pool.end();
  }
}

verifyFinalFix();
