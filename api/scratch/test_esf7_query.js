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

async function testQuery() {
    try {
        const region = "BLANK REGION";
        const division = "BLANK DIVISION";
        
        let query = `
            SELECT 
                s.school_id, 
                s.school_name, 
                COALESCE(el.status, 'NOT_STARTED') as status,
                s.region,
                s.division
            FROM ph_schools s
            LEFT JOIN esf7_link el ON s.school_id = el.school_id
            WHERE 1=1
        `;
        const params = [];
        if (region && region !== 'All') {
            params.push(region);
            query += ` AND UPPER(TRIM(s.region)) = UPPER(TRIM($${params.length}))`;
        }
        if (division && division !== 'All Divisions') {
            params.push(division);
            query += ` AND UPPER(TRIM(s.division)) = UPPER(TRIM($${params.length}))`;
        }
        
        console.log("Running Query:", query);
        console.log("Params:", params);

        const res = await pool.query(query, params);
        console.log("Results Count:", res.rows.length);
        if (res.rows.length > 0) {
            console.log("Sample:", JSON.stringify(res.rows[0], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testQuery();
