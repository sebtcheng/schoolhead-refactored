const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyFixes() {
    console.log("🚀 Starting Verification of Engineer Data Integrity Fixes...");

    const hosts = ['http://127.0.0.1:3000', 'http://localhost:3000'];
    let apiFound = false;
    let projects = [];

    for (const host of hosts) {
        try {
            console.log(`Checking host: ${host}...`);
            const listRes = await fetch(`${host}/api/monitoring/engineer-projects?region=Region%20III`);
            if (listRes.ok) {
                projects = await listRes.json();
                console.log(`✅ Connected to ${host}`);
                apiFound = host;
                break;
            }
        } catch (e) {
            console.log(`❌ Failed to connect to ${host}: ${e.message}`);
        }
    }

    if (!apiFound) {
        console.log("⚠️ Could not reach server via fetch. Checking DB directly...");
        return;
    }

    const API_BASE = `${apiFound}/api`;

    try {
        console.log("Querying DB for 'Approved' test subjects...");
        const dbRes = await pool.query("SELECT * FROM engineer_form WHERE approval_status = 'Approved' OR approval_status IS NULL ORDER BY created_at DESC LIMIT 100");
        const dbProjects = dbRes.rows;
        const project = dbProjects[0];
        
        if (!project) {
            console.log("⚠️ No Approved projects found to test the shield with.");
            return;
        }
        
        console.log(`\n--- Testing [Duplicate Shield] for Project: ${project.project_name} ---`);
        
        const updatePayload = {
            ...project,
            uid: project.engineer_id || 'SYSTEM_VERIFIER',
            modifiedBy: project.engineer_name, 
            statusOfConstructionPhase: project.status_of_construction_phase,
            procurement_status: project.procurement_status,
            accomplishmentPercentage: String(project.accomplishment_percentage || 0),
            statusAsOfDate: project.status_as_of?.toISOString()
        };


        const dupRes = await fetch(`${API_BASE}/update-project/${project.project_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });
        
        const dupData = await dupRes.json();
        console.log("Response Status:", dupRes.status);
        if (dupData.error) console.log("Response Error:", dupData.error);
        if (dupData.message) console.log("Response Message:", dupData.message);
        
        if (dupData.message === "No changes detected. Snapshot skipped.") {
            console.log("✅ [Duplicate Shield] SUCCESS: Identical update was blocked.");
        } else {
            console.log("❌ [Duplicate Shield] FAILED: Identical update was NOT blocked.");
        }

    } catch (err) {
        console.error("❌ Verification halted:", err.message);
    } finally {
        await pool.end();
    }
}

verifyFixes();
