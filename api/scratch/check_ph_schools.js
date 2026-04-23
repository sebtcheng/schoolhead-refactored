import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools' ORDER BY column_name");
        console.log("COLUMNS IN ph_schools:");
        res.rows.forEach(r => console.log(`- ${r.column_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
