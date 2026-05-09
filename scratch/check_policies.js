
import pkg from 'pg';
const { Client } = pkg;

async function checkPolicies() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT * FROM pg_policies WHERE tablename = 'ph_schools'`);
        console.log("Policies on ph_schools:");
        console.log(res.rows);

        const rulesRes = await client.query(`SELECT * FROM pg_rules WHERE tablename = 'ph_schools'`);
        console.log("Rules on ph_schools:");
        console.log(rulesRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkPolicies();
