const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log("--- ESF7_LINK (school 999009) ---");
        const resLink = await pool.query("SELECT school_id, link, file_path, status, updated_at FROM esf7_link WHERE school_id = '999009'");
        console.log(JSON.stringify(resLink.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
