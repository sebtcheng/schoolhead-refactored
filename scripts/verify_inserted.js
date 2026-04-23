import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const uids = ['rkB6z2vJzeUkW3zDCywcdOkgjN43', 'L670YlWGQWM60q6aHUj9lKICaV73'];
        console.log("Checking for UIDs in users table:", uids);

        const usersList = await pool.query(`
            SELECT uid, email, role, first_name, last_name FROM users WHERE uid = ANY($1)
        `, [uids]);

        console.log("Found users: ", usersList.rows);
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
};

run();
