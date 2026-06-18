import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected to insightEd...');

  // Describe columns of ph_ecart_batches
  const resCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'ph_ecart_batches'
    ORDER BY ordinal_position
  `);
  console.log('Columns in ph_ecart_batches:');
  resCols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  // Check row count
  const resCount = await client.query('SELECT COUNT(*) FROM ph_ecart_batches');
  console.log(`Total rows in ph_ecart_batches: ${resCount.rows[0].count}`);

  // Fetch sample rows
  const resSample = await client.query('SELECT * FROM ph_ecart_batches LIMIT 3');
  console.log('Sample rows:');
  console.log(JSON.stringify(resSample.rows, null, 2));

  await client.end();
}

main().catch(console.error);
