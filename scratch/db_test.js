import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  console.log('Attempting to connect to:', process.env.DATABASE_URL.split('@')[1]);
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL');
    const res = await client.query('SELECT NOW(), current_database()');
    console.log('Current Time:', res.rows[0].now);
    console.log('Database:', res.rows[0].current_database);
    
    const tableRes = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Total tables in public schema:', tableRes.rows[0].count);
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:');
    console.error(err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
  } finally {
    await pool.end();
  }
}

testConnection();
