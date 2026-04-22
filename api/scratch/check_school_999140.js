import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchool() {
    try {
        const res = await pool.query(`
            SELECT school_id, school_name, region, division 
            FROM ph_schools 
            WHERE school_id = '999140'
        `);
        console.log(JSON.stringify(res.rows[0], null, 2));
        
        const linkRes = await pool.query(`
            SELECT school_id, status FROM esf7_link WHERE school_id = '999140'
        `);
        console.log("Link Status:", JSON.stringify(linkRes.rows[0], null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkSchool();
