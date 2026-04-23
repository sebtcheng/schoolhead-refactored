import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        const usersCols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        fs.writeFileSync('users_cols.txt', usersCols.rows.map(r => r.column_name).join('\n'));
    } catch (err) {
        console.error(err.message);
    } finally {
        await pool.end();
    }
};

run();
