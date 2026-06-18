import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected to staging...');

  // Get triggers on ph_schools and unit6_school_resources
  const res = await client.query(`
    SELECT 
      trigger_name,
      event_object_table,
      action_statement,
      action_orientation,
      action_timing
    FROM information_schema.triggers
    WHERE event_object_table IN ('ph_schools', 'unit6_school_resources')
  `);
  console.log('Triggers found:');
  console.log(JSON.stringify(res.rows, null, 2));

  // Get trigger function source code
  const resFuncs = await client.query(`
    SELECT 
      p.proname,
      p.prosrc
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname IN ('ph_schools', 'unit6_school_resources')
  `);
  console.log('Trigger functions:');
  resFuncs.rows.forEach(r => {
    console.log(`\n--- Function: ${r.proname} ---`);
    console.log(r.prosrc);
  });

  await client.end();
}

main().catch(console.error);
