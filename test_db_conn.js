import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('20.24.58.49');

console.log(`Testing connection to: ${dbUrl}`);
console.log(`isLocal: ${isLocal}`);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 5000,
});

async function runTest() {
  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to Pool");
    const res = await client.query('SELECT NOW(), version()');
    console.log("✅ Query successful:", res.rows[0]);
    client.release();
    console.log("✅ Client released");
  } catch (err) {
    console.error("❌ Connection failed:", err);
  } finally {
    await pool.end();
    console.log("Test finished");
  }
}

runTest();
