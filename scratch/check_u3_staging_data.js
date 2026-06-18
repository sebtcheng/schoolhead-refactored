import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  const res = await client.query('SELECT COUNT(*) FROM unit3_organized_classes');
  console.log(`Total rows in unit3_organized_classes (staging): ${res.rows[0].count}`);

  const resCompleted = await client.query(`
    SELECT COUNT(*) FROM unit3_organized_classes 
    WHERE unit3_completed = 100.00
  `);
  console.log(`Completed rows in unit3_organized_classes (staging): ${resCompleted.rows[0].count}`);

  // Fetch a sample row
  if (parseInt(res.rows[0].count) > 0) {
    const sample = await client.query('SELECT * FROM unit3_organized_classes LIMIT 1');
    console.log('Sample row:', sample.rows[0]);
  }

  await client.end();
}
main().catch(console.error);
