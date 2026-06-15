import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
    ssl: false
});

async function run() {
    try {
        console.log("Querying schools...");
        const res = await pool.query(`
            SELECT school_id, school_name, iern, curricular_offering, unit5_completed
            FROM ph_schools 
            ORDER BY unit1_updated_at DESC NULLS LAST, school_id LIMIT 10
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
