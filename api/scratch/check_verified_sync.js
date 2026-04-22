import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query("SELECT school_id, status FROM esf7_link WHERE status = 'VERIFIED' LIMIT 5");
        console.log("Verified Schools in esf7_link:", res.rows);

        if (res.rows.length > 0) {
            const sid = res.rows[0].school_id;
            const phRes = await pool.query("SELECT school_id, division, region FROM ph_schools WHERE school_id = $1", [sid]);
            console.log(`Checking school ${sid} in ph_schools:`, phRes.rows);

            const iernRes = await pool.query('SELECT "SchoolID", "School_Name", "Region" FROM "schools_IERN" WHERE "SchoolID" = $1', [sid]);
            console.log(`Checking school ${sid} in schools_IERN:`, iernRes.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
check();
