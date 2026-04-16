import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkLocks() {
  const client = await pool.connect();
  try {
    console.log("Checking for active locks and blocking queries...");
    
    const res = await client.query(`
      SELECT
        COALESCE(blockingl.relation::regclass::text,blockingl.locktype) as locked_item,
        now() - blockeda.query_start AS waiting_duration,
        blockeda.pid AS blocked_pid,
        blockeda.query AS blocked_query,
        blockinga.pid AS blocking_pid,
        blockinga.query AS blocking_query
      FROM pg_catalog.pg_locks blockedl
      JOIN pg_catalog.pg_stat_activity blockeda ON blockedl.pid = blockeda.pid
      JOIN pg_catalog.pg_locks blockingl ON(
        (blockingl.transactionid=blockedl.transactionid AND blockingl.pid != blockedl.pid)
        OR
        (blockingl.relation=blockedl.relation AND blockingl.locktype=blockedl.locktype AND blockingl.pid != blockedl.pid)
      )
      JOIN pg_catalog.pg_stat_activity blockinga ON blockingl.pid = blockinga.pid
      WHERE NOT blockedl.granted
      AND blockinga.datname = current_database()
    `);
    
    if (res.rows.length > 0) {
      console.log("FOUND BLOCKED QUERIES:");
      res.rows.forEach((r, i) => {
        console.log(`\n--- Blocked Case ${i+1} ---`);
        console.log(`Locked Item: ${r.locked_item}`);
        console.log(`Waiting For: ${r.waiting_duration}`);
        console.log(`Blocked PID: ${r.blocked_pid}`);
        console.log(`Blocked Query: ${r.blocked_query.substring(0, 100)}...`);
        console.log(`Blocking PID: ${r.blocking_pid}`);
        console.log(`Blocking Query: ${r.blocking_query.substring(0, 100)}...`);
      });
    } else {
      console.log("No blocking locks found.");
      
      console.log("\nChecking all active queries...");
      const activeRes = await client.query(`
        SELECT pid, state, query_start, query 
        FROM pg_stat_activity 
        WHERE state != 'idle' AND pid != pg_backend_pid()
        ORDER BY query_start ASC
      `);
      activeRes.rows.forEach((r, i) => {
        console.log(`\n--- Active Query ${i+1} ---`);
        console.log(`PID: ${r.pid}`);
        console.log(`State: ${r.state}`);
        console.log(`Started: ${r.query_start}`);
        console.log(`Query: ${r.query.substring(0, 200)}...`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkLocks();
