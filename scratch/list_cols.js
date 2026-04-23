import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function list() {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'esf7_database'");
    res.rows.forEach(r => console.log(r.column_name));
    await pool.end();
}
list();
