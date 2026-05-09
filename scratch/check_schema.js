
import pkg from 'pg';
const { Client } = pkg;

async function checkSchema() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ph_schools'");
        console.log("Columns in ph_schools:");
        console.log(res.rows.map(r => r.column_name).join(", "));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkSchema();
