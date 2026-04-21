import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function patch() {
    console.log("🛠️  Performing Massive ESF7 Schema Overhaul...");
    try {
        const headersJson = JSON.parse(fs.readFileSync('headers.json', 'utf8'));
        let seen = {};
        let colDefinitions = [];
        headersJson.forEach((h, i) => {
             let base = String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
             if (base === 'id') base = 'source_id';
             
             // Skip blank/empty columns
             if (base === '' || base === '_') return;

             if (seen[base]) { 
                 seen[base]++; 
                 base = `${base}_${seen[base]}`; 
             } else { 
                 seen[base] = 1; 
             }
             colDefinitions.push(`"${base}" TEXT`);
        });

        // NUCLEAR FIX: Always guarantee appt_yyyy column exists
        if (!colDefinitions.some(c => c.includes('"appt_yyyy"'))) {
            colDefinitions.push('"appt_yyyy" TEXT');
        }

        // Add core system fields from UNIT 1
        colDefinitions.push('"school_id" TEXT');
        colDefinitions.push('"iern" TEXT');

        await pool.query('DROP TABLE IF EXISTS ESF7_Database');
        await pool.query('DROP TABLE IF EXISTS ESF7_Staging');

        const createDbSql = `CREATE TABLE ESF7_Database (
            id SERIAL PRIMARY KEY,
            ${colDefinitions.join(',\n            ')}
        )`;

        const createStagingSql = `CREATE TABLE ESF7_Staging (
            id SERIAL PRIMARY KEY,
            ${colDefinitions.join(',\n            ')}
        )`;

        console.log("   🗳️ Creating Flat ESF7_Database with 400+ Columns...");
        await pool.query(createDbSql);
        
        console.log("   🗳️ Creating Flat ESF7_Staging with 400+ Columns...");
        await pool.query(createStagingSql);

        console.log("✅ Database structure is now FLAT and INDIVIDUALIZED. No more JSON blobs.");
    } catch (err) {
        console.error("❌ Schema Overhaul Failed:", err.message);
    } finally {
        await pool.end();
    }
}

patch();
