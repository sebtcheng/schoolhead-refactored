
import pkg from 'pg';
const { Client } = pkg;

async function checkUsersUnique() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT
                conname as constraint_name,
                contype as constraint_type,
                pg_get_constraintdef(c.oid) as constraint_definition
            FROM
                pg_constraint c
            JOIN
                pg_namespace n ON n.oid = c.connamespace
            WHERE
                contype IN ('u', 'p') AND conrelid = 'users'::regclass;
        `);
        console.log("Constraints on users table:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUsersUnique();
