
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:STRIDE_ADMIN_PASS_2026@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log("Checking teachers_list column info...");
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teachers_list' AND (column_name = 'school.id' OR column_name = 'school_id')
    `);
    console.log("Column Info:", res.rows);

    console.log("Checking indices on teachers_list...");
    const indices = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'teachers_list'
    `);
    console.log("Indices:", indices.rows);

    console.log("Checking row count in teachers_list...");
    const count = await pool.query('SELECT COUNT(*) FROM teachers_list');
    console.log("Total Count:", count.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
