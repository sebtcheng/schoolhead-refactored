import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const match = envContent.match(/DATABASE_URL=(.+)/);
    if (match) dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
}

if (!dbUrl) {
    console.error("No DATABASE_URL found");
    process.exit(1);
}

const fixUrl = dbUrl.replace(':6432', ':5432')
    .replace('20.24.58.49', 'stride-posgre-prod-01.postgres.database.azure.com');

const pool = new pg.Pool({
    connectionString: fixUrl,
    ssl: { rejectUnauthorized: false }
});

async function createDuplicatesTable() {
    const client = await pool.connect();
    try {
        console.log("Creating engineer_forms_duplicates table...");
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS engineer_forms_duplicates (
                LIKE engineer_form INCLUDING ALL
            );
        `);
        
        // Add tracking columns for provenance
        const colCheck = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_forms_duplicates' AND column_name = 'archived_at'");
        if (colCheck.rows.length === 0) {
            await client.query("ALTER TABLE engineer_forms_duplicates ADD COLUMN archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP");
            await client.query("ALTER TABLE engineer_forms_duplicates ADD COLUMN superseded_by_id INTEGER");
            console.log("Added tracking columns.");
        }

        console.log("✅ engineer_forms_duplicates table is ready.");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

createDuplicatesTable();
