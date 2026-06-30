import pg from 'pg';
const { Client } = pg;

async function checkStaging() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging",
        ssl: false
    });

    try {
        await client.connect();
        console.log("✅ Connected successfully to 'insighted-staging' database!");

        console.log("\n--- SEARCH FOR TABLES WITH nsbi or building ---");
        const tableRes = await client.query(`
            SELECT table_schema, table_name, table_type 
            FROM information_schema.tables 
            WHERE table_name ILIKE '%nsbi%' OR table_name ILIKE '%building%'
        `);
        console.table(tableRes.rows);

    } catch (err) {
        console.error("❌ Connection failed:", err.message);
    } finally {
        await client.end();
    }
}

checkStaging();
