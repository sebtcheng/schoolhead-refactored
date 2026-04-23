const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

async function fixUser() {
    const oldUid = 'vNI6tTropDNmsGW2j6ElVYwFJJs1';
    const newUid = 'tpIlyboG8PgITndkCSTTkvWWWKh1';
    const schoolId = '301718';
    const email = '301718pnhs@deped.gov.ph'; // The real email

    console.log(`Starting to fix user for school ${schoolId}...`);

    try {
        const res = await pool.query('UPDATE school_profiles SET submitted_by = $1 WHERE school_id = $2 RETURNING *', [newUid, schoolId]);
        console.log(`Updated school_profiles ${res.rowCount} rows`);

        // Let's also check if they are in the 'users' table or if we need to insert them
        const userRes = await pool.query('SELECT * FROM users WHERE uid = $1', [newUid]);
        if (userRes.rows.length === 0) {
            await pool.query(`
        INSERT INTO users (uid, email, role, first_name, last_name, disabled)
        VALUES ($1, $2, 'school_head', 'Panacan National High School', '', false)
      `, [newUid, email]);
            console.log(`Inserted ${newUid} into users table.`);
        } else {
            console.log(`${newUid} already in users table.`);
        }

        // Now testing logic
        console.log("SUCCESS!");
    } catch (err) {
        console.error("Error fixing DB:", err);
    }

    process.exit();
}

fixUser();
