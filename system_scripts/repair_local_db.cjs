// Repair script targeting the LOCAL PostgreSQL (insight_pooled) - the one the API actually uses
// Usage: node repair_local_db.cjs [school_id]   (default: 151006)
//        node repair_local_db.cjs all            (repair all schools)
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@127.0.0.1:6432/insight_pooled?prepare_threshold=0',
  ssl: false
});

const DB_COLS = [1, 2, 3, 4, 5, 6, 7, 9]; // unit9 = display unit 8 (terrain/location)

async function repairSchool(school_id) {
  const iernRes = await pool.query(
    'SELECT school_id, iern, unit_completion FROM ph_schools WHERE school_id = $1',
    [school_id]
  );
  if (!iernRes.rows.length) {
    console.log(`School ${school_id} not found`);
    return;
  }
  const { iern, unit_completion: old_pct } = iernRes.rows[0];

  const r = await pool.query(
    `SELECT unit1,unit2,unit3,unit4,unit5,unit6,unit7,unit9,
            unit1_completed,unit2_completed,unit3_completed,unit4_completed,
            unit5_completed,unit6_completed,unit7_completed,unit9_completed
     FROM ph_schools WHERE iern=$1`,
    [iern]
  );
  const row = r.rows[0];

  let count = 0;
  const bools = [];
  for (const i of DB_COLS) {
    const done = (parseInt(row[`unit${i}`] || 0) === 1) || (row[`unit${i}_completed`] === true);
    bools.push(done);
    if (done) count++;
  }

  const pct = parseFloat(((count / 8) * 100).toFixed(2));
  console.log(`School ${school_id} | iern=${iern} | ${old_pct}% → ${pct}% (${count}/8 units)`);

  // Fix the unit*_completed booleans in ph_schools (this is what progress endpoint reads)
  await pool.query(
    `UPDATE ph_schools SET
       unit1_completed=$1, unit2_completed=$2, unit3_completed=$3, unit4_completed=$4,
       unit5_completed=$5, unit6_completed=$6, unit7_completed=$7, unit9_completed=$8,
       unit_completion=$9
     WHERE iern=$10`,
    [...bools, pct, iern]
  );

  // Also fix ph_school_completion if it exists
  const pscCheck = await pool.query('SELECT iern FROM ph_school_completion WHERE iern=$1', [iern]);
  if (pscCheck.rows.length > 0) {
    await pool.query(
      `UPDATE ph_school_completion SET
         unit1_completion=$2, unit2_completion=$3, unit3_completion=$4, unit4_completion=$5,
         unit5_completion=$6, unit6_completion=$7, unit7_completion=$8, unit8_completion=$9,
         total_completion=$1, updated_at=NOW()
       WHERE iern=$10`,
      [pct, ...bools, iern]
    );
  }

  return { school_id, iern, old_pct, new_pct: pct, count };
}

async function main() {
  const arg = process.argv[2] || '151006';

  try {
    if (arg === 'all') {
      const all = await pool.query('SELECT school_id FROM ph_schools WHERE school_id IS NOT NULL ORDER BY school_id');
      console.log(`Repairing ${all.rows.length} schools...`);
      let fixed = 0, errors = 0;
      for (const { school_id } of all.rows) {
        try {
          await repairSchool(school_id);
          fixed++;
        } catch (e) {
          console.error(`  ERROR for ${school_id}:`, e.message);
          errors++;
        }
      }
      console.log(`\nDone: ${fixed} repaired, ${errors} errors`);
    } else {
      const result = await repairSchool(arg);
      if (result) {
        console.log('\n--- Verification ---');
        const v = await pool.query(
          `SELECT unit_completion, unit1_completed, unit2_completed, unit3_completed,
                  unit4_completed, unit5_completed, unit6_completed, unit7_completed, unit9_completed
           FROM ph_schools WHERE school_id=$1`,
          [arg]
        );
        console.log(JSON.stringify(v.rows[0], null, 2));
      }
    }
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    pool.end();
  }
}

main();
