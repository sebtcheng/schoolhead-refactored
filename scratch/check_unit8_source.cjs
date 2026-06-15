const { Pool } = require('pg');

// Check STAGING (local dev connects here)
const staging = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging' });
// Check PRODUCTION
const prod = new Pool({ connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd' });

const SCHOOL_ID = '999163';

async function check() {
  try {
    console.log(`\n🔍 Checking school_id = ${SCHOOL_ID}\n`);

    // --- STAGING ---
    console.log('=== STAGING (insighted-staging) ===');
    const s1 = await staging.query(`SELECT school_id, iern, cellular_coverage, road_paved_pct, transportation_modes FROM school_location_profiles WHERE school_id = $1`, [SCHOOL_ID]);
    console.log('school_location_profiles:', s1.rows.length ? s1.rows[0] : '❌ NO DATA');

    const s2 = await staging.query(`SELECT school_id, iern, cellular_coverage, road_paved_pct, transportation_modes FROM unit8_location WHERE school_id = $1`, [SCHOOL_ID]);
    console.log('unit8_location:          ', s2.rows.length ? s2.rows[0] : '❌ NO DATA');

    // --- PRODUCTION ---
    console.log('\n=== PRODUCTION (insightEd) ===');
    const p1 = await prod.query(`SELECT school_id, iern, cellular_coverage, road_paved_pct, transportation_modes FROM school_location_profiles WHERE school_id = $1`, [SCHOOL_ID]);
    console.log('school_location_profiles:', p1.rows.length ? p1.rows[0] : '❌ NO DATA');

    const p2 = await prod.query(`SELECT school_id, iern, cellular_coverage, road_paved_pct, transportation_modes FROM unit8_location WHERE school_id = $1`, [SCHOOL_ID]);
    console.log('unit8_location:          ', p2.rows.length ? p2.rows[0] : '❌ NO DATA');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await staging.end();
    await prod.end();
  }
}

check();
