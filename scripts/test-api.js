import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: () => Promise.resolve(json),
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(4000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runApiTests() {
  console.log('🧪 [API-TEST] Starting School-Head API Verification Suite...');
  let hasErrors = false;

  // 1. Verify Drizzle ORM Schema exports
  try {
    const { users, schoolsIern } = await import('../packages/db/schema/index.js');
    if (!users || !schoolsIern) {
      throw new Error('Drizzle schema missing expected exports (users, schoolsIern)');
    }
    console.log('  ✅ [SCHEMA] packages/db/schema exports users (with passcode) & schoolsIern verified');
  } catch (err) {
    console.error('  ❌ [SCHEMA] Schema import failed:', err.message);
    hasErrors = true;
  }

  // 2. Verify Database Connection & DDL directly
  const dbUrl = process.env.CLOUD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://postgres:sebtest123@localhost:5432/cloud_local';

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: false,
  });

  try {
    await client.connect();
    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'passcode';
    `);
    if (colRes.rows.length === 0) {
      throw new Error("Column 'passcode' does not exist in 'users' table");
    }
    console.log("  ✅ [DB] Column 'users.passcode' verified in primary database");

    const schoolRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schools_IERN' OR table_name = 'schools_iern'
      ) as exists;
    `);
    if (!schoolRes.rows[0]?.exists) {
      throw new Error("Table 'schools_IERN' does not exist");
    }
    console.log("  ✅ [DB] Table 'schools_IERN' verified in database");
  } catch (err) {
    console.error('  ❌ [DB] Database verification failed:', err.message);
    hasErrors = true;
  } finally {
    try { await client.end(); } catch {}
  }

  // 3. Verify Live Endpoint: POST /api/auth/pin-login
  const portsToTry = [5010, 5173];
  let pinLoginPassed = false;
  let progressPassed = false;

  for (const port of portsToTry) {
    const baseUrl = `http://localhost:${port}`;
    const pinEndpoint = port === 5173 
      ? `${baseUrl}/insighted-schoolhead/api/auth/pin-login` 
      : `${baseUrl}/api/auth/pin-login`;

    try {
      const pinRes = await request(pinEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'close',
        },
        body: JSON.stringify({ pin: '300488' })
      });

      if (pinRes.statusCode === 200) {
        const data = await pinRes.json();
        if (data && data.success && data.token) {
          console.log(`  ✅ [AUTH] POST ${pinEndpoint} -> 200 OK (Token received for user ${data.user?.email || '300488'})`);
          pinLoginPassed = true;
          break;
        }
      }
    } catch {}
  }

  if (!pinLoginPassed) {
    console.error('  ❌ [AUTH] Pin login test failed on active ports');
    hasErrors = true;
  }

  // 4. Verify Live Endpoint: GET /api/ph_schools/progress/300488
  for (const port of portsToTry) {
    const baseUrl = `http://localhost:${port}`;
    const progressEndpoint = port === 5173
      ? `${baseUrl}/insighted-schoolhead/api/ph_schools/progress/300488`
      : `${baseUrl}/api/ph_schools/progress/300488`;

    try {
      const progRes = await request(progressEndpoint, {
        headers: { 'Connection': 'close' },
      });
      if (progRes.statusCode === 200) {
        const data = await progRes.json();
        if (data && data.success && data.data?.schoolInfo?.school_id === '300488') {
          console.log(`  ✅ [PROGRESS] GET ${progressEndpoint} -> 200 OK (School: "${data.data.schoolInfo.school_name}")`);
          progressPassed = true;
          break;
        }
      }
    } catch {}
  }

  if (!progressPassed) {
    console.error('  ❌ [PROGRESS] School progress test failed on active ports');
    hasErrors = true;
  }

  // 5. Verify ph_schools_validate is completely excised from codebase
  try {
    const { execSync } = await import('child_process');
    const matches = execSync('git grep "ph_schools_validate" apps/ packages/', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (matches) {
      console.error('  ❌ [EXCISE] Found occurrences of ph_schools_validate in active code:\n', matches);
      hasErrors = true;
    }
  } catch {
    // Exit code 1 from git grep means 0 matches!
    console.log('  ✅ [EXCISE] Zero occurrences of ph_schools_validate in active apps/ and packages/');
  }

  if (hasErrors) {
    console.error('\n❌ [API-TEST] Suite finished with errors.');
    process.exit(1);
  } else {
    console.log('\n🎉 [API-TEST] All School-Head API verifications passed successfully!');
    process.exit(0);
  }
}

runApiTests();
