/**
 * InsightEd - Selective School Data Purge (Interactive)
 * Removes records ONLY from the specific tables requested.
 * 
 * Usage: node system_scripts/cleanup_school_interactive.js
 */

import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const TABLES_TO_CLEAN = [
    'ph_buildings_demolition',
    'ph_buildings_inventory',
    'ph_buildings_repairs',
    'ph_ecart_batches',
    'ph_school_buildable_spaces',
    'school_location_profiles',
    'school_ownership_docs',
    'ph_school_completion',
    'pending_schools',
    'school_documents',
    'schools_IERN',
    'users',
    'ph_schools'
];

async function purge(schoolId) {
    if (!schoolId || schoolId.trim() === '') {
        console.error("❌ Error: Invalid School ID.");
        rl.close();
        process.exit(1);
    }

    console.log(`\n🚀 Starting selective purge for School ID: ${schoolId}`);
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        for (const table of TABLES_TO_CLEAN) {
            try {
                // Table-specific column handling
                let columnName = 'school_id';
                if (table === 'schools_IERN') {
                    columnName = 'SchoolID'; // Case sensitive for schools_IERN
                }

                // Execute deletion using parameter binding for safety
                // We use double quotes around column names that might be case-sensitive or reserved
                const res = await client.query(`DELETE FROM "${table}" WHERE "${columnName}" = $1`, [schoolId]);
                console.log(` ✅ [${table}] Deleted ${res.rowCount} records.`);
            } catch (err) {
                // If table doesn't exist, just log and continue (optional, but safer)
                if (err.message.includes('does not exist')) {
                    console.log(` ⚠️ [${table}] Table does not exist, skipping.`);
                } else {
                    console.error(` ❌ [${table}] Error: ${err.message}`);
                    throw err;
                }
            }
        }

        await client.query('COMMIT');
        console.log("\n✨ Purge completed successfully.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("\n💥 Transaction rolled back due to error.");
    } finally {
        client.release();
        await pool.end();
        rl.close();
    }
}

console.log("--- InsightEd School Cleanup Tool ---");
rl.question("Enter the School ID to remove records for: ", (answer) => {
    purge(answer.trim());
});
