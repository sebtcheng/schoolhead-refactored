import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});

async function checkSchool() {
  try {
    const schoolId = '151006';
    console.log(`Duplicate Check school ${schoolId} in production...`);
    
    const r1 = await pool.query('SELECT school_id, iern, submitted_by, unit_completion FROM ph_schools WHERE school_id = $1', [schoolId]);
    console.log('PH_SCHOOLS Records Summary:', r1.rows);
    
    const r2 = await pool.query('SELECT school_id, iern, submitted_by, unit_completion FROM ph_schools WHERE submitted_by = $1', ['74b5a6a5-56ce-4f2b-87ad-37f4beffc9d4']);
    console.log('Schools submitted by the user:', r2.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

checkSchool();
