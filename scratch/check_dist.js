
import pkg from 'pg';
const { Client } = pkg;

async function checkDistribution() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query("SELECT school_id FROM ph_schools WHERE school_id::text LIKE '999%'");
        const ids = res.rows.map(r => r.school_id).sort();
        console.log(`Total 999* schools in ph_schools: ${ids.length}`);
        console.log("Samples:", ids.slice(0, 10), "...", ids.slice(-10));

        const userRes = await client.query("SELECT school_id FROM users WHERE school_id::text LIKE '999%'");
        console.log(`Total 999* schools in users: ${userRes.rows.length}`);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkDistribution();
