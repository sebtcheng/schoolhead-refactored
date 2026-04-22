import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: false 
});

async function testQuery() {
  const email = 'david.pacheco@deped.gov.ph';
  console.log(`Analyzing query for: ${email}`);
  try {
    const res = await pool.query(`EXPLAIN ANALYZE SELECT * FROM users WHERE LOWER(email) = $1`, [email]);
    console.log("QUERY PLAN:");
    res.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (err) {
    console.error("❌ Query failed:", err);
  } finally {
    await pool.end();
  }
}

testQuery();
