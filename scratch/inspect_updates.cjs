const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspectTable() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type, ordinal_position 
            FROM information_schema.columns 
            WHERE table_name = 'third_level_officials_updates'
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspectTable();
