const { Pool } = require('pg');

const DB_URL = "postgresql://insightadmin:C-0mplexP-4ssw0rd!@insight-prod-db.postgres.database.azure.com:6432/insight_db?sslmode=require";

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function triggerFlags() {
    let client;
    try {
        client = await pool.connect();
        console.log("🔍 Fetching schools with facilities anomalies...");

        const query = `
            SELECT 
                s.school_id, 
                s.iern, 
                s.school_name, 
                s.division,
                s.total_enrollment,
                COALESCE(s.build_classrooms_total, 0) as rooms,
                u.uid as head_uid
            FROM ph_schools s
            LEFT JOIN users u ON s.school_id = u.school_id AND u.role = 'School Head'
            WHERE s.has_facilities_anomaly = TRUE
        `;
        
        const { rows: schools } = await client.query(query);
        console.log(`Found ${schools.length} schools to flag.`);

        const system_uid = "00000000-0000-0000-0000-000000000000";
        const system_name = "InsightEd Audit Bot";

        await client.query('BEGIN');

        for (const s of schools) {
            let instruction;
            if (parseInt(s.rooms) === 0) {
                instruction = `URGENT: Your school reports ${s.total_enrollment} learners but ZERO physical facilities. Please update Unit 7 (Physical Facilities) with your building and classroom inventory immediately.`;
            } else {
                const ratio = s.total_enrollment / s.rooms;
                instruction = `ANOMALY DETECTED: Your learner-to-room ratio is ${ratio.toFixed(1)}:1 (${s.total_enrollment} learners in ${s.rooms} rooms). This exceeds critical thresholds. Please verify and update your Physical Facilities inventory.`;
            }

            // Insert Audit Task
            await client.query(`
                INSERT INTO audit_feedback_tasks (school_id, iern, unit_id, instruction, auditor_uid, auditor_name, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [s.school_id, s.iern, 'unit7', instruction, system_uid, system_name, 'flagged']);

            // School Head Notification
            if (s.head_uid) {
                await client.query(`
                    INSERT INTO notifications (recipient_uid, sender_uid, sender_name, title, message, type)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [s.head_uid, system_uid, system_name, "Audit Flag: Physical Facilities", instruction, "correction"]);
            }
        }

        // Notify SDO Admins
        const divisions = [...new Set(schools.map(s => s.division).filter(Boolean))];
        console.log(`Notifying SDO admins in ${divisions.length} divisions...`);

        for (const div of divisions) {
            const { rows: sdo_users } = await client.query("SELECT uid FROM users WHERE role = 'School Division Office' AND division = $1", [div]);
            const div_count = schools.filter(s => s.division === div).length;

            for (const sdo of sdo_users) {
                await client.query(`
                    INSERT INTO notifications (recipient_uid, sender_uid, sender_name, title, message, type)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [sdo.uid, system_uid, system_name, "Automated Audit Alert", 
                    `System Audit has flagged ${div_count} schools in your division for physical infrastructure anomalies. Please review the Audit Dashboard.`, 
                    "alert"]);
            }
        }

        await client.query('COMMIT');
        console.log("✅ All flags and notifications triggered successfully.");

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("❌ Error:", err.message);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

triggerFlags();
