import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  
  const targetPid = 2835486;
  console.log(`Attempting to terminate backend process PID: ${targetPid}`);
  
  const res = await client.query(`SELECT pg_terminate_backend($1)`, [targetPid]);
  console.log('Terminated successfully:', res.rows[0].pg_terminate_backend);

  // Also terminate the blocked query process PID: 2834497 so we can restart fresh
  const targetBlockedPid = 2834497;
  console.log(`Attempting to terminate blocked process PID: ${targetBlockedPid}`);
  const res2 = await client.query(`SELECT pg_terminate_backend($1)`, [targetBlockedPid]);
  console.log('Terminated blocked successfully:', res2.rows[0].pg_terminate_backend);

  await client.end();
}
main().catch(console.error);
