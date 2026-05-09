
import pkg from 'pg';
const { Client } = pkg;

async function findLock() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT 
                proname, 
                prosrc 
            FROM pg_proc 
            WHERE prosrc LIKE '%InsightEd-2026-DocLock%'
        `);
        console.log("Functions containing DocLock:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

findLock();
