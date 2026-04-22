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

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log("Fetching columns...");
        const resCols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'engineer_form' 
            AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        const columns = resCols.rows.map(r => `"${r.column_name}"`).join(', ');

        console.log("Starting migration of Pending projects...");
        
        const insertSql = `
            INSERT INTO engineer_create (${columns})
            SELECT ${columns} FROM engineer_form
            WHERE approval_status = 'Pending'
        `;
        const resInsert = await client.query(insertSql);
        console.log(`Successfully moved ${resInsert.rowCount} rows to engineer_create.`);

        const deleteSql = `
            DELETE FROM engineer_form
            WHERE approval_status = 'Pending'
        `;
        const resDelete = await client.query(deleteSql);
        console.log(`Successfully deleted ${resDelete.rowCount} rows from engineer_form.`);

        await client.query('COMMIT');
        console.log("Migration committed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", err.message);
        if (err.detail) console.error("Detail:", err.detail);
        if (err.where) console.error("Where:", err.where);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
