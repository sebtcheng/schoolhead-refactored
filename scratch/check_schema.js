import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd'
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ph_schools'
    `);
    console.log('ph_schools columns:');
    console.table(res.rows);

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'school_ownership_docs'
    `);
    console.log('school_ownership_docs columns:');
    console.table(res2.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkSchema();
