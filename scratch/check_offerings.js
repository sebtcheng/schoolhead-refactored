import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
    ssl: false
});

async function run() {
    try {
        console.log("Unique Curricular Offerings:");
        const res = await pool.query(`
            SELECT DISTINCT curricular_offering, COUNT(*) 
            FROM ph_schools 
            GROUP BY curricular_offering 
            ORDER BY count DESC
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
