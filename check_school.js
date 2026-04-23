import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query("SELECT * FROM esf7_link WHERE school_id = '999140'");
        console.log("RECORD:", res.rows[0]);
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

check();
