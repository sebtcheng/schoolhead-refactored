const { Pool } = require('pg');
require('dotenv').config();

async function doubleCheckOwnership() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("🧐 Forensic Cross-Check: Linking 83 Empty Projects to Hidden Photos...");

        // 1. Get the list of 83 projects at 100% without photos (Current)
        const emptyProjectsRes = await pool.query(`
            SELECT p.project_id, p.ipc, p.school_name, p.project_name, p.division
            FROM engineer_form p
            WHERE (p.status_of_construction_phase IN ('Completed', 'For Final Inspection') OR p.accomplishment_percentage = 100)
            AND NOT EXISTS (
                SELECT 1 FROM engineer_image i 
                WHERE i.project_id = p.project_id OR (i.ipc = p.ipc AND i.ipc IS NOT NULL)
            )
            LIMIT 100
        `);
        const emptyProjects = emptyProjectsRes.rows;
        console.log(`📊 analyzing ${emptyProjects.length} candidate projects...`);

        let matchedCount = 0;
        const matches = [];

        for (const p of emptyProjects) {
            // Search ARCHIVE or OTHERS for photos with same School + Project Name
            // Joining engineer_image with the Archive table to find where they went
            const matchRes = await pool.query(`
                SELECT i.id as photo_id, a.project_id as old_project_id, a.ipc as old_ipc, i.uploaded_by, i.created_at
                FROM engineer_image i
                JOIN engineer_form_archive a ON i.project_id = a.project_id
                WHERE a.school_name = $1 AND a.project_name = $2
                AND a.project_id != $3
            `, [p.school_name, p.project_name, p.project_id]);

            if (matchRes.rows.length > 0) {
                matchedCount++;
                matches.push({
                    currentProjectId: p.project_id,
                    ipc: p.ipc,
                    projectName: p.project_name,
                    schoolName: p.school_name,
                    foundPhotos: matchRes.rows.length,
                    oldIpc: matchRes.rows[0].old_ipc,
                    examplePhotoId: matchRes.rows[0].photo_id
                });
            }
        }

        console.log(`✅ Result: Found hidden photos for ${matchedCount} out of ${emptyProjects.length} projects in the Archive.`);
        
        if (matches.length > 0) {
            console.log("\n--- Example Matches Found ---");
            console.table(matches.slice(0, 5));
            console.log("This proves that the photos exist in the Archive table lineage, but the link to the Live table was lost.");
        } else {
            console.log("❌ No matches found in the Archive. Checking the main table for mismatched IPCs...");
            // Fallback: Check if photos exist in engineer_image but tied to a DIFFERENT IPC for the same school/project
            const fallbackRes = await pool.query(`
                SELECT COUNT(DISTINCT i.project_id)
                FROM engineer_image i
                JOIN engineer_form p2 ON i.project_id = p2.project_id
                WHERE EXISTS (
                    SELECT 1 FROM engineer_form p3 
                    WHERE (p3.status_of_construction_phase IN ('Completed', 'For Final Inspection') OR p3.accomplishment_percentage = 100)
                    AND p2.school_name = p3.school_name AND p2.project_name = p3.project_name
                    AND p2.project_id != p3.project_id
                )
            `);
            console.log(`🔍 Hidden photos found in main table (mismatched ID/IPC): ${fallbackRes.rows[0].count}`);
        }

    } catch (err) {
        console.error("❌ Cross-Check Failed:", err.message);
    } finally {
        await pool.end();
    }
}

doubleCheckOwnership();
