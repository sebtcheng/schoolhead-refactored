import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const uids = ['rkB6z2vJzeUkW3zDCywcdOkgjN43', 'L670YlWGQWM60q6aHUj9lKICaV73'];
        console.log("Updating role to 'School Head' for UIDs:", uids);

        const updateResult = await pool.query(`
            UPDATE users SET role = 'School Head' WHERE uid = ANY($1) RETURNING *
        `, [uids]);

        console.log("Updated users: ", updateResult.rows);
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
};

run();
