import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd',
  ssl: false
});

async function main() {
  await client.connect();

  const res = await client.query(`
    SELECT school_id, unit3_simplified_counts::text 
    FROM ph_schools 
    WHERE unit3_simplified_counts IS NOT NULL
  `);

  console.log('--- Checking for non-standard grade levels in Unit 3 simplified counts ---');
  res.rows.forEach(r => {
    const arr = JSON.parse(r.unit3_simplified_counts);
    arr.forEach(item => {
      const g = item.grade_level;
      const isStandard = g === 'kinder' || /^g\d+$/.test(g);
      if (!isStandard) {
        console.log(`School: ${r.school_id} | Grade Level: ${g} | Item:`, item);
      }
    });
  });

  await client.end();
}
main().catch(console.error);
