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

async function checkProjectIDType() {
    try {
        const resForm = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default, is_identity, identity_generation
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form' AND column_name = 'project_id'
        `);
        const resCreate = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default, is_identity, identity_generation
            FROM information_schema.columns 
            WHERE table_name = 'engineer_create' AND column_name = 'project_id'
        `);
        
        console.log("engineer_form project_id:", resForm.rows[0]);
        console.log("engineer_create project_id:", resCreate.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkProjectIDType();
