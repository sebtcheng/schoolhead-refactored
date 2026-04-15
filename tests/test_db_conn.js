import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testDB() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();
        console.log('Connected.');
        const res = await client.query('SELECT current_database(), current_user');
        console.log('DB Info:', res.rows[0]);
        client.release();
        await pool.end();
    } catch (err) {
        console.error('DB Connection Failed:', err.message);
    }
}

testDB();
