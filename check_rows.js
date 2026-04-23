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
        const colRes = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'esf7_database'
            AND column_name LIKE '%status%'
        `);
        console.log("Status Columns Found:");
        console.table(colRes.rows);
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

check();
