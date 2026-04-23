const pg = require('pg');

const dbUrl = 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';

async function testSSL(useSSL) {
  console.log(`\n🧪 Testing with SSL: ${useSSL}`);
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });

  try {
    const start = Date.now();
    const res = await pool.query('SELECT 1');
    console.log(`✅ Success! Time: ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
  } finally {
    await pool.end();
  }
}

async function runTests() {
  await testSSL(false);
  await testSSL(true);
}

runTests();
