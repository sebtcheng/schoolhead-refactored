const { Pool } = require('pg');

const pool = new Pool({
    connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd",
    ssl: { rejectUnauthorized: false },
    max: 10
});

// Reuse the logic from api/index.js (simplified for standalone use)
async function updateSchoolTotalCompletion(iern) {
  if (!iern) return;
  try {
    const res = await pool.query(
      `SELECT school_id, unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10,
              unit1_completed, unit2_completed, unit3_completed, unit4_completed,
              unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed, unit10_completed
       FROM ph_schools WHERE iern = $1`,
      [iern]
    );
    if (res.rows.length === 0) return;

    const row = res.rows[0];
    const schoolId = row.school_id;
    const dbCols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let completedCount = 0;
    const boolValues = [];
    for (const idx of dbCols) {
      const done = (parseInt(row[`unit${idx}`]) === 1 || row[`unit${idx}_completed`] === true);
      boolValues.push(done);
      if (done) completedCount++;
    }

    const percentage = parseFloat(((completedCount / 10) * 100).toFixed(2));

    await pool.query(
      `INSERT INTO ph_school_completion
         (iern, school_id, unit1_completion, unit2_completion, unit3_completion, unit4_completion,
          unit5_completion, unit6_completion, unit7_completion, unit8_completion, unit9_completion, unit10_completion, total_completion, updated_at)
       VALUES ($12, $13, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (iern) DO UPDATE SET
         unit1_completion=$2, unit2_completion=$3, unit3_completion=$4, unit4_completion=$5,
         unit5_completion=$6, unit6_completion=$7, unit7_completion=$8, unit8_completion=$9,
         unit9_completion=$10, unit10_completion=$11, total_completion=$1, updated_at=CURRENT_TIMESTAMP`,
      [percentage, ...boolValues, iern, schoolId]
    );

    await pool.query(
      'UPDATE ph_schools SET unit_completion=$1 WHERE iern=$2',
      [percentage, iern]
    );

    console.log(`[REPAIR] Updated completion for ${iern}: ${percentage}% (${completedCount}/10)`);
  } catch (err) {
    console.error(`[ERROR] updateSchoolTotalCompletion failed for ${iern}:`, err.message);
  }
}

async function runRepair() {
    console.log("🚀 Starting Bulk Completion Repair...");
    const targetIern = process.argv[2];

    try {
        if (targetIern) {
            console.log(`Targeting single school: ${targetIern}`);
            // Resolve actual IERN if School ID was passed
            const resolveRes = await pool.query('SELECT iern FROM ph_schools WHERE iern = $1 OR school_id = $1', [targetIern]);
            const actualIern = resolveRes.rows[0]?.iern;
            if (actualIern) {
                await updateSchoolTotalCompletion(actualIern);
            } else {
                console.error(`Could not find school with identifier: ${targetIern}`);
            }
        } else {
            const schools = await pool.query('SELECT iern FROM ph_schools WHERE iern IS NOT NULL');
            console.log(`Iterating through ${schools.rows.length} schools...`);
            for (const row of schools.rows) {
                await updateSchoolTotalCompletion(row.iern);
            }
        }
        console.log("✅ Repair Finished.");
    } catch (err) {
        console.error("CRITICAL REPAIR ERROR:", err);
    } finally {
        await pool.end();
    }
}

runRepair();
