
import pkg from 'pg';
const { Client } = pkg;

async function checkUsersDup() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query("SELECT school_id, COUNT(*) FROM users GROUP BY school_id HAVING COUNT(*) > 1");
        console.log("Duplicate school_ids in users:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUsersDup();
