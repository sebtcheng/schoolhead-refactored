
import pkg from 'pg';
const { Client } = pkg;

async function checkTriggers() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT 
                tgname as trigger_name,
                prosrc as function_definition
            FROM 
                pg_trigger
            JOIN 
                pg_proc ON pg_proc.oid = pg_trigger.tgfoid
            WHERE 
                tgrelid = 'ph_schools'::regclass;
        `);
        console.log("Triggers on ph_schools:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTriggers();
