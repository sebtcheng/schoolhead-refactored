const { Pool } = require('pg');
require('dotenv').config();

async function auditOrphans() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("🔍 Starting Orphan Audit...");

        // 1. Orphaned Images
        const imgRes = await pool.query(`
            SELECT COUNT(*) FROM engineer_image 
            WHERE project_id NOT IN (SELECT project_id FROM engineer_form)
        `);
        console.log(`📸 Orphaned Images (project_id mismatch): ${imgRes.rows[0].count}`);

        // 2. Orphaned Documents
        const docRes = await pool.query(`
            SELECT COUNT(*) FROM engineer_documents 
            WHERE project_id NOT IN (SELECT project_id FROM engineer_form)
        `);
        console.log(`📄 Orphaned Documents (project_id mismatch): ${docRes.rows[0].count}`);

        // 3. Images with valid project_id but at 100% completion in form?
        // Wait, the user is worried about missing photos.
        const missingPhotosRes = await pool.query(`
            SELECT COUNT(*) FROM engineer_form e
            WHERE (e.status_of_construction_phase IN ('Completed', 'For Final Inspection') OR e.accomplishment_percentage = 100)
            AND NOT EXISTS (
                SELECT 1 FROM engineer_image i 
                WHERE i.project_id = e.project_id OR (i.ipc = e.ipc AND i.ipc IS NOT NULL)
            )
        `);
        console.log(`❌ Projects at 100% missing ANY photo: ${missingPhotosRes.rows[0].count}`);

        // 4. Can we recover orphans via IPC?
        const recoveryRes = await pool.query(`
            SELECT COUNT(*) FROM engineer_image i
            WHERE i.project_id NOT IN (SELECT project_id FROM engineer_form)
            AND i.ipc IN (SELECT ipc FROM engineer_form WHERE ipc IS NOT NULL)
        `);
        console.log(`🛠️ Orphaned Images potentially recoverable via IPC: ${recoveryRes.rows[0].count}`);

    } catch (err) {
        console.error("❌ Audit Failed:", err.message);
    } finally {
        await pool.end();
    }
}

auditOrphans();
