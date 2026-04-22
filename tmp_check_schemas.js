import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkSchemas() {
    try {
        const ids = ['114042', '114374', '114183', '502995', '502994', '502996'];
        const iern = await pool.query(`
            SELECT "SchoolID", "School_Name", "Barangay", "status" FROM "schools_IERN" 
            WHERE "SchoolID" = ANY($1)
        `, [ids]);
        console.log('IERN schools after migration:');
        console.table(iern.rows);

        const pending = await pool.query(`
            SELECT "school_id", "old_school_id", "school_name", "status" FROM "pending_schools" 
            WHERE "school_id" = ANY($1)
        `, [ids]);
        console.log('Pending schools after migration:');
        console.table(pending.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkSchemas();
