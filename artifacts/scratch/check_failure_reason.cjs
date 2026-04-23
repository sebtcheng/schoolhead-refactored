const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkFailureReason() {
    try {
        console.log("🕵️ Inspecting pgboss failure reasons...");
        
        const res = await pool.query(`
            SELECT id, name, state, data, output
            FROM pgboss.job 
            WHERE name = 'esf7-local-scan'
            ORDER BY id DESC
            LIMIT 3
        `);

        res.rows.forEach((row, i) => {
            console.log(`\n--- Job #${i+1} (ID: ${row.id}) ---`);
            console.log(`State: ${row.state}`);
            console.log(`Data:`, JSON.stringify(row.data, null, 2));
            console.log(`Output/Error:`, JSON.stringify(row.output, null, 2));
        });

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        await pool.end();
    }
}

checkFailureReason();
