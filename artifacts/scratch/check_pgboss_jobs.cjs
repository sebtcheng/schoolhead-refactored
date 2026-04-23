const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkJobs() {
    try {
        console.log("🔍 Checking pg-boss and esf7_scan_results tables...");
        
        // 1. Check esf7_scan_results
        const resResults = await pool.query("SELECT status, count(*) FROM esf7_scan_results GROUP BY status");
        console.log("\n--- ESF7 Scan Results ---");
        console.table(resResults.rows);

        // 2. Check pgboss internal jobs
        // Note: pgboss creates its own schema, usually 'pgboss' or based on the db
        const resBoss = await pool.query(`
            SELECT name, state, count(*) 
            FROM pgboss.job 
            WHERE name = 'esf7-local-scan'
            GROUP BY name, state
        `);
        console.log("\n--- PG-BOSS Internal Jobs ---");
        console.table(resBoss.rows);

        // 3. Check recent errors
        const resErrors = await pool.query("SELECT job_id, error, updated_at FROM esf7_scan_results WHERE status = 'FAILED' ORDER BY updated_at DESC LIMIT 5");
        if (resErrors.rows.length > 0) {
            console.log("\n--- Recent Failures ---");
            console.table(resErrors.rows);
        }

    } catch (err) {
        console.error("❌ Error during check:", err.message);
    } finally {
        await pool.end();
    }
}

checkJobs();
