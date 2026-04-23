const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log("--- ESF7_LINK ---");
        const resLink = await pool.query("SELECT * FROM esf7_link WHERE school_id = '999009'");
        console.log(JSON.stringify(resLink.rows, null, 2));

        console.log("\n--- ESF7_SCAN_RESULTS ---");
        const resScan = await pool.query("SELECT * FROM esf7_scan_results WHERE school_id = '999009' ORDER BY updated_at DESC LIMIT 5");
        console.log(JSON.stringify(resScan.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
