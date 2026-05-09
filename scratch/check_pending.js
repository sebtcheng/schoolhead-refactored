
import pkg from 'pg';
const { Client } = pkg;

async function checkPending() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query("SELECT COUNT(*) FROM pending_schools WHERE \"SchoolID\"::text LIKE '999%'");
        console.log(`Test schools in pending_schools: ${res.rows[0].count}`);
    } catch (err) {
        // Table might not exist or column name different
        console.error(err.message);
    } finally {
        await client.end();
    }
}

checkPending();
