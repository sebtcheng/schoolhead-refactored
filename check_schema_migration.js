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

async function checkSchema() {
    try {
        const resForm = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form'`);
        const resCreate = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_create'`);
        
        const formCols = new Set(resForm.rows.map(r => r.column_name));
        const createCols = new Set(resCreate.rows.map(r => r.column_name));

        const onlyInForm = [...formCols].filter(c => !createCols.has(c)).sort();
        const onlyInCreate = [...createCols].filter(c => !formCols.has(c)).sort();

        console.log("Only in engineer_form:", onlyInForm);
        console.log("Only in engineer_create:", onlyInCreate);
        console.log("Intersection size:", [...formCols].filter(c => createCols.has(c)).length);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
