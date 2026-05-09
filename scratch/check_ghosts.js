
import pkg from 'pg';
const { Client } = pkg;

async function checkGhosts() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT school_id, email, created_at 
            FROM users 
            WHERE school_id::text LIKE '999%' 
            AND school_id NOT IN (SELECT school_id FROM ph_schools WHERE school_id IS NOT NULL)
            ORDER BY created_at DESC
            LIMIT 10
        `);
        console.log("Sample Ghost Users:");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkGhosts();
