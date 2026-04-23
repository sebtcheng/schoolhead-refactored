import admin from 'firebase-admin';
import pg from 'pg';
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require("../api/service-account.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const uids = ['rkB6z2vJzeUkW3zDCywcdOkgjN43', 'L670YlWGQWM60q6aHUj9lKICaV73'];
        
        for (const uid of uids) {
            console.log("Checking firebase for UID:", uid);
            try {
                const userRecord = await admin.auth().getUser(uid);
                console.log("Found in Firebase:", userRecord.email, userRecord.displayName);
                
                // Let's split displayName into first_name and last_name roughly
                const nameParts = (userRecord.displayName || "").split(" ");
                const firstName = nameParts[0] || "";
                const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
                
                const role = "school_head"; 
                
                console.log("Inserting to postgres users table...");
                await pool.query(`
                    INSERT INTO users (uid, email, role, first_name, last_name, created_at, disabled)
                    VALUES ($1, $2, $3, $4, $5, NOW(), false)
                    ON CONFLICT (uid) 
                    DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role
                `, [uid, userRecord.email, role, firstName, lastName]);
                console.log("Inserted or updated in postgres.");
                
            } catch (err) {
                console.error("Error with Firebase user", uid, err.message);
            }
        }
        
    } catch (err) {
        console.error("General error:", err.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
};

run();
