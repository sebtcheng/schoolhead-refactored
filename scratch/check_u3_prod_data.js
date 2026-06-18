import pg from 'pg';
const { Client } = pg;

// Connect to the production database 'insightEd'
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();
  console.log('Connected to production database: insightEd');

  // Check ph_schools
  const resPh = await client.query(`
    SELECT 
      COUNT(*) as total_rows,
      COUNT(*) FILTER (WHERE unit3_sections IS NOT NULL) as not_null_sections_count,
      COUNT(*) FILTER (WHERE unit3_completed = TRUE) as completed_count
    FROM ph_schools
  `);
  console.log('Production ph_schools Unit 3 counts:', resPh.rows[0]);

  // Check unit3_organized_classes table in production
  try {
    const resClasses = await client.query('SELECT COUNT(*) FROM unit3_organized_classes');
    console.log('Production unit3_organized_classes count:', resClasses.rows[0].count);

    if (parseInt(resClasses.rows[0].count) > 0) {
      const sample = await client.query('SELECT * FROM unit3_organized_classes LIMIT 1');
      console.log('Sample production unit3_organized_classes row:', sample.rows[0]);
    }
  } catch (err) {
    console.error('Error querying unit3_organized_classes in production:', err.message);
  }

  await client.end();
}
main().catch(console.error);
