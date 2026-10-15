const pg = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/SIIF_DATABASE_URL=(.+)/);
if (!match) {
  console.error("No SIIF_DATABASE_URL found in .env");
  process.exit(1);
}

const base = new URL(match[1].trim());
const dbs = ['insightEd', 'insighted-staging', 'siif_database_v2'];

async function main() {
  for (const db of dbs) {
    base.pathname = '/' + db;
    const pool = new pg.Pool({
      connectionString: base.toString(),
      ssl: { rejectUnauthorized: false }
    });

    try {
      const current = await pool.query('SELECT value FROM settings WHERE key = $1', ['nexus_module_locks']);
      let locks = { 'school-info': false, 'esf7': false, 'nspp': true, 'siif': true };
      if (current.rows.length > 0 && current.rows[0].value) {
        try {
          locks = { ...JSON.parse(current.rows[0].value), siif: true };
        } catch (e) {
          console.warn(`Could not parse existing JSON in ${db}, using default`);
        }
      }

      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
        ['nexus_module_locks', JSON.stringify(locks)]
      );

      const check = await pool.query('SELECT key, value, updated_at FROM settings WHERE key = $1', ['nexus_module_locks']);
      console.log(`✅ [${db}] settings row:`, check.rows[0]);
    } catch (err) {
      console.error(`❌ [${db}] Error:`, err.message);
    } finally {
      await pool.end();
    }
  }
}

main();
