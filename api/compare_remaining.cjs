const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function compare() {
  try {
    const res = await pool.query("SELECT * FROM engineer_form WHERE project_id IN (1009772, 1009720)");
    const r1 = res.rows[0];
    const r2 = res.rows[1];
    
    console.log("Comparing IDs 1009772 and 1009720:");
    const diffs = [];
    for (let key in r1) {
      if (['project_id', 'ipc', 'created_at'].includes(key)) continue;
      if (JSON.stringify(r1[key]) !== JSON.stringify(r2[key])) {
        diffs.push({
          column: key,
          val1: r1[key],
          val2: r2[key]
        });
      }
    }
    
    if (diffs.length === 0) {
      console.log("No differences found in the 93 columns!");
    } else {
      console.log("Found differences:");
      console.table(diffs);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

compare();
