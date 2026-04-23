const pg = require('pg');
const pool = new pg.Pool({ 
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'ph_schools\'');
        res.rows.forEach(r => console.log(r.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
check();
