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

async function checkColumns() {
    try {
        const resForm = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'engineer_form' ORDER BY ordinal_position`);
        const resCreate = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'engineer_create' ORDER BY ordinal_position`);
        
        console.log("Form Columns Count:", resForm.rows.length);
        console.log("Create Columns Count:", resCreate.rows.length);

        const formCols = resForm.rows.map(r => r.column_name);
        const createCols = resCreate.rows.map(r => r.column_name);

        for (let i = 0; i < Math.max(formCols.length, createCols.length); i++) {
            if (formCols[i] !== createCols[i]) {
                console.log(`Mismatch at index ${i}: Form='${formCols[i]}', Create='${createCols[i]}'`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkColumns();
