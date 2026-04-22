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

async function checkPendingAssets() {
    try {
        const resImages = await pool.query(`
            SELECT count(*) 
            FROM engineer_image ei
            JOIN engineer_form ef ON ei.project_id = ef.project_id
            WHERE ef.approval_status = 'Pending'
        `);
        console.log("Images for pending projects:", resImages.rows[0].count);

        const resDocs = await pool.query(`
            SELECT count(*) 
            FROM engineer_documents ed
            JOIN engineer_form ef ON ed.project_id = ef.project_id
            WHERE ef.approval_status = 'Pending'
        `);
        console.log("Documents for pending projects:", resDocs.rows[0].count);

        const resProjDocs = await pool.query(`
            SELECT count(*) 
            FROM project_documents pd
            JOIN engineer_form ef ON pd.project_id = ef.project_id
            WHERE ef.approval_status = 'Pending'
        `);
        console.log("Project Documents for pending projects:", resProjDocs.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkPendingAssets();
