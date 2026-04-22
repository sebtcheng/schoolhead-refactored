const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        console.log("Checking HRODI/EFD users...");
        const users = await pool.query("SELECT uid, email, role FROM users WHERE role ILIKE '%HRODI%' OR role ILIKE '%EFD%' OR email ILIKE '%pacheco%'");
        console.table(users.rows);

        if (users.rows.length > 0) {
            const uid = users.rows[0].uid;
            const role = users.rows[0].role;
            console.log(`\nChecking projects for user ${uid} (${role})...`);
            
            const countRes = await pool.query("SELECT COUNT(*) FROM engineer_form WHERE engineer_id = $1", [uid]);
            console.log(`Projects directly assigned to this UID: ${countRes.rows[0].count}`);
            
            const totalRes = await pool.query("SELECT COUNT(*) FROM engineer_form");
            console.log(`Total projects in engineer_form: ${totalRes.rows[0].count}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
