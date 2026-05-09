
import pkg from 'pg';
const { Client } = pkg;

async function checkPending() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query("SELECT COUNT(*) FROM pending_schools WHERE school_id::text LIKE '999%' AND is_deleted = false");
        console.log(`Test schools in pending_schools (active): ${res.rows[0].count}`);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkPending();
