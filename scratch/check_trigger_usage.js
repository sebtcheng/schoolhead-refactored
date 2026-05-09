
import pkg from 'pg';
const { Client } = pkg;

async function checkTriggerUsage() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT 
                relname as table_name,
                tgname as trigger_name
            FROM 
                pg_trigger
            JOIN 
                pg_class ON pg_class.oid = pg_trigger.tgrelid
            JOIN 
                pg_proc ON pg_proc.oid = pg_trigger.tgfoid
            WHERE 
                proname = 'block_deletion_trigger_func'
        `);
        console.log("Tables using block_deletion_trigger_func:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTriggerUsage();
