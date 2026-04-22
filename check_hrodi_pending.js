import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL;
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('20.24.58.49');

const { Pool } = pg;
const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function checkPendingInHRODI() {
    try {
        const res = await pool.query(`
            SELECT hp.project_id 
            FROM hrodi_project hp
            JOIN engineer_form ef ON hp.project_id = ef.project_id
            WHERE ef.approval_status = 'Pending'
        `);
        console.log("Pending projects in hrodi_project count:", res.rows.length);
        if (res.rows.length > 0) {
            console.log("Example project_ids:", res.rows.slice(0, 5).map(r => r.project_id));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkPendingInHRODI();
