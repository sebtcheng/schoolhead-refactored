const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    const result = await pool.query("SELECT * FROM users WHERE uid = 'tpIlyboG8PgITndkCSTTkvWWWKh1'");
    console.log("USERS table:");
    console.log(result.rows);

    const spResult = await pool.query("SELECT school_id, submitted_by FROM school_profiles WHERE school_id = '301718'");
    console.log("SCHOOL_PROFILES table:");
    console.log(spResult.rows);

    process.exit(0);
}
verify();
