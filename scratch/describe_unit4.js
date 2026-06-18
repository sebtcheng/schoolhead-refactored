import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  console.log('--- Staging unit4_learner_profile Columns ---');
  const res = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'unit4_learner_profile'
    ORDER BY ordinal_position
  `);
  
  res.rows.forEach(r => {
    console.log(`${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`);
  });

  await client.end();
}

main().catch(console.error);
