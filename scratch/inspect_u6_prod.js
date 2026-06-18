import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected to insightEd production...');

  // Get one row where unit7_furniture or unit7_ecarts or unit7_ict is populated
  const res = await client.query(`
    SELECT school_id, iern, unit7_furniture, unit7_ict, unit7_wash, unit7_utilities, unit7_ecarts, unit7_completed, unit6_updated_at
    FROM ph_schools
    WHERE unit7_furniture IS NOT NULL AND unit7_furniture::text <> '[]'
    LIMIT 1
  `);

  if (res.rows.length > 0) {
    console.log('Sample row data:');
    console.log(JSON.stringify(res.rows[0], null, 2));
  } else {
    console.log('No rows found matching condition.');
  }

  await client.end();
}

main().catch(console.error);
