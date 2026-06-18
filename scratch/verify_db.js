import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log("Connected successfully to DB.");
  
  const tables = [
    'unit1_school_identity',
    'unit2_school_learners',
    'unit3_organized_classes',
    'unit4_learner_profile',
    'unit5_shifting_modality',
    'unit6_school_resources',
    'unit7_facilities',
    'unit8_location',
    'unit9_safety'
  ];
  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'school_yr'
    `, [table]);
    
    if (res.rowCount > 0) {
      console.log(`✅ Table "${table}" has column "school_yr"`);
      
      const counts = await client.query(`
        SELECT school_yr, count(*) 
        FROM ${table} 
        GROUP BY school_yr
      `);
      console.log(`   Record breakdown for ${table}:`);
      console.table(counts.rows);
    } else {
      console.log(`❌ Table "${table}" is missing the "school_yr" column.`);
    }
  }

  // Now, let's select a school from ph_schools that has units completed (100% in SY 25-26)
  const schoolRes = await client.query(`
    SELECT school_id, school_name, iern, unit_completion
    FROM ph_schools 
    WHERE unit_completion IS NOT NULL AND unit_completion > 0
    LIMIT 1
  `);
  
  if (schoolRes.rows.length > 0) {
    const school = schoolRes.rows[0];
    console.log(`\n--- Progress details for ${school.school_name} (${school.school_id}) ---`);
    console.log(`ph_schools.unit_completion (old/static value): ${school.unit_completion}`);
    
    // Run the progress query for this school for 'SY 26-27'
    const schoolYr = 'SY 26-27';
    const progressRes = await client.query(
      `SELECT ps.school_id, ps.school_name, ps.unit_completion,
       COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
       CASE WHEN u1.unit1_completed = TRUE THEN 100 ELSE COALESCE(u1.unit1, 0) END AS unit1,
       COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
       CASE WHEN COALESCE(u2.unit2_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit2,
       COALESCE(u3.unit3_completed = 100.00, FALSE) AS unit3_completed,
       CASE WHEN COALESCE(u3.unit3_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit3,
       COALESCE(u4.unit4_completed = 100.00, FALSE) AS unit4_completed,
       CASE WHEN COALESCE(u4.unit4_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit4,
       COALESCE(u5.unit5_completed, FALSE) AS unit5_completed,
       CASE WHEN COALESCE(u5.unit5_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u5.unit5, 0) END AS unit5,
       COALESCE(u6.unit6_completed, FALSE) AS unit6_completed,
       CASE WHEN COALESCE(u6.unit6_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit6,
       COALESCE(u7.unit7_completed, FALSE) AS unit7_completed,
       CASE WHEN COALESCE(u7.unit7_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u7.unit7, 0) END AS unit7,
       COALESCE(u8.unit8_completed, FALSE) AS unit8_completed,
       CASE WHEN COALESCE(u8.unit8_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u8.unit8, 0) END AS unit8,
       COALESCE(u9.unit9_completed, FALSE) AS unit9_completed,
       CASE WHEN COALESCE(u9.unit9_completed, FALSE) = TRUE THEN 100 ELSE COALESCE(u9.unit9, 0) END AS unit9
       FROM ph_schools ps
       LEFT JOIN unit1_school_identity u1 ON ps.iern = u1.iern AND u1.school_yr = $2
       LEFT JOIN unit2_school_learners u2 ON ps.iern = u2.iern AND u2.school_yr = $2
       LEFT JOIN unit3_organized_classes u3 ON ps.iern = u3.iern AND u3.school_yr = $2
       LEFT JOIN unit4_learner_profile u4 ON ps.iern = u4.iern AND u4.school_yr = $2
       LEFT JOIN unit5_shifting_modality u5 ON ps.iern = u5.iern AND u5.school_yr = $2
       LEFT JOIN unit6_school_resources u6 ON ps.school_id = u6.school_id AND u6.school_yr = $2
       LEFT JOIN unit7_facilities u7 ON ps.school_id = u7.school_id AND u7.school_yr = $2
       LEFT JOIN unit8_location u8 ON ps.school_id = u8.school_id AND u8.school_yr = $2
       LEFT JOIN unit9_safety u9 ON ps.school_id = u9.school_id AND u9.school_yr = $2
       WHERE ps.school_id = $1`,
      [school.school_id, schoolYr]
    );
    console.log("Calculated progress for SY 26-27:", progressRes.rows[0]);
  }
  
  await client.end();
}
main().catch(console.error);
