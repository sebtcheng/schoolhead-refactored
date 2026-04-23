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

async function reset() {
    try {
        await pool.query("UPDATE esf7_link SET status = 'NOT_STARTED', link = 'PENDING', file_path = NULL WHERE school_id = '999140'");
        await pool.query("UPDATE ph_schools SET unit7 = 0, unit7_status = 'NOT_STARTED' WHERE school_id = '999140'");
        console.log("✅ Success: School 999140 fully reset to NOT_STARTED.");
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

reset();
