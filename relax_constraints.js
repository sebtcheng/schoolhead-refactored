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

async function relaxConstraints() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const constraints = [
            { table: 'engineer_image', name: 'engineer_image_project_id_fkey' },
            { table: 'project_documents', name: 'project_documents_project_id_fkey' },
            { table: 'hrodi_project', name: 'hrodi_project_project_id_fkey' },
            { table: 'co_finance', name: 'co_finance_project_id_fkey' },
            { table: 'engineer_documents', name: 'engineer_documents_project_id_fkey' }
        ];

        for (const conn of constraints) {
            console.log(`Dropping FK ${conn.name} on ${conn.table}...`);
            await client.query(`ALTER TABLE "${conn.table}" DROP CONSTRAINT IF EXISTS "${conn.name}"`);
        }

        console.log("Adding indexes for performance (if they don't exist)...");
        for (const conn of constraints) {
            const indexName = `idx_${conn.table}_project_id`;
            await client.query(`CREATE INDEX IF NOT EXISTS "${indexName}" ON "${conn.table}" ("project_id")`);
        }

        await client.query('COMMIT');
        console.log("Constraints relaxed successfully.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Failed to relax constraints:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

relaxConstraints();
