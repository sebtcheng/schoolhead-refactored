import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  
  console.log('--- Active Queries ---');
  const resQueries = await client.query(`
    SELECT pid, query, state, age(clock_timestamp(), query_start) as duration, wait_event_type, wait_event
    FROM pg_stat_activity 
    WHERE state != 'idle' AND pid != pg_backend_pid()
  `);
  resQueries.rows.forEach(r => {
    console.log(`PID: ${r.pid} | State: ${r.state} | Duration: ${r.duration}`);
    console.log(`Query: ${r.query.substring(0, 200)}`);
    console.log(`Wait: ${r.wait_event_type} - ${r.wait_event}`);
    console.log('-------------------------------------------');
  });

  // If there are blocked queries, let's look at them
  console.log('\n--- Locks ---');
  const resLocks = await client.query(`
    SELECT blocked_locks.pid     AS blocked_pid,
         blocked_activity.usename  AS blocked_user,
         blocking_locks.pid    AS blocking_pid,
         blocking_activity.usename AS blocking_user,
         blocked_activity.query    AS blocked_statement,
         blocking_activity.query   AS blocking_statement
    FROM  pg_catalog.pg_locks         blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks         blocking_locks 
        ON blocking_locks.locktype = blocked_locks.locktype
        AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
        AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
        AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
        AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
        AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
        AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
        AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
        AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
        AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
        AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted
  `);
  if (resLocks.rows.length === 0) {
    console.log('No blocked locks found.');
  } else {
    resLocks.rows.forEach(r => {
      console.log(`Blocked PID: ${r.blocked_pid} is waiting for Blocking PID: ${r.blocking_pid}`);
      console.log(`Blocked Statement: ${r.blocked_statement}`);
      console.log(`Blocking Statement: ${r.blocking_statement}`);
      console.log('-------------------------------------------');
    });
  }

  await client.end();
}
main().catch(console.error);
