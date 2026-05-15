const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    try {
        const res = await pool.query("SELECT id, iern, school_id, binary_id, file_size, original_size, compressed_size, compressed_binary_id FROM school_ownership_docs ORDER BY created_at DESC LIMIT 5");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
