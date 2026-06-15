import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Print columns of schools_IERN
    const colsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schools_IERN'
    `);
    console.log('📋 Columns in schools_IERN:');
    console.log(colsRes.rows.map(r => `${r.column_name} (${r.data_type})`));
    
    // Print a sample row
    const sampleRes = await client.query('SELECT * FROM "schools_IERN" LIMIT 1');
    console.log('🔍 Sample row:');
    console.log(sampleRes.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

main();
