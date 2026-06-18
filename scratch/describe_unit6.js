import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();

  const tables = ['unit6_ecart_batches', 'unit6_furniture_grades', 'unit6_school_resources'];

  for (const table of tables) {
    console.log(`\n--- Staging ${table} Columns ---`);
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    
    res.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`);
    });
  }

  await client.end();
}

main().catch(console.error);
