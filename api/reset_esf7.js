import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reset() {
    try {
        const res = await pool.query("UPDATE esf7_link SET status = 'QUEUED'");
        console.log(`✅ Reset ${res.rowCount} schools to QUEUED.`);
    } catch (err) {
        console.error("❌ Reset failed:", err.message);
    } finally {
        await pool.end();
    }
}

reset();
