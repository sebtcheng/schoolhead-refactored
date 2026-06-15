import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging",
    ssl: false
});

async function run() {
    try {
        console.log("Searching school in ph_schools:");
        const res = await pool.query(`
            SELECT school_id, school_name, iern, unit5, unit5_completed, unit_completion
            FROM ph_schools 
            WHERE school_id = '999163' OR iern = '999163'
        `);
        console.log("Rows count:", res.rows.length);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
run();
