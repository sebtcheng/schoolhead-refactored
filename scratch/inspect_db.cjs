const pg = require('pg');
require('dotenv').config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type, ordinal_position 
            FROM information_schema.columns 
            WHERE table_name = 'third_level_officials_masterlist'
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(res.rows, null, 2));
        
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log("Tables:", tables.rows.map(t => t.table_name).join(', '));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
