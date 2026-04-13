const { Pool } = require('pg');
require('dotenv').config();

async function deepAuditOwnership() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("🧐 Deep Forensic Audit: Verification of Project 'Ownership' for photos...");

        // Get 10 samples from the 43 potential matches
        const verificationQ = await pool.query(`
            SELECT 
                p1.project_id as current_id, p1.school_id as current_school_id, 
                p1.project_name as current_name, p1.funding_year as current_year,
                p2.project_id as other_id, p2.funding_year as other_year,
                p2.ipc as other_ipc,
                (SELECT COUNT(*) FROM engineer_image i WHERE i.project_id = p2.project_id) as photo_count
            FROM engineer_form p1
            JOIN engineer_form p2 ON p1.school_id = p2.school_id AND p1.project_name = p2.project_name
            WHERE (p1.status_of_construction_phase IN ('Completed', 'For Final Inspection') OR p1.accomplishment_percentage = 100)
            AND NOT EXISTS (SELECT 1 FROM engineer_image i WHERE i.project_id = p1.project_id OR i.ipc = p1.ipc)
            AND EXISTS (SELECT 1 FROM engineer_image i WHERE i.project_id = p2.project_id)
            AND p1.project_id != p2.project_id
            LIMIT 10
        `);

        if (verificationQ.rows.length === 0) {
            console.log("No ambiguous matches found with these criteria.");
        } else {
            console.log("\n--- Verification Data for User ---");
            const comparison = verificationQ.rows.map(r => ({
                "School ID": r.current_school_id,
                "Project Name": r.current_name,
                "Current Project (100%)": `ID: ${r.current_id} | Year: ${r.current_year}`,
                "Old Project (Has Photos)": `ID: ${r.other_id} | Year: ${r.other_year} | IPC: ${r.other_ipc}`,
                "Photos": r.photo_count,
                "Match Quality": (r.current_year === r.other_year) ? "🌟 High (Same Year)" : "⚠️ Medium (Different Years)"
            }));
            console.table(comparison);
        }

    } catch (err) {
        console.error("❌ Deep Audit Failed:", err.message);
    } finally {
        await pool.end();
    }
}

deepAuditOwnership();
