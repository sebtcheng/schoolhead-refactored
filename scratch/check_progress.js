import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insighted-staging',
  ssl: false
});

async function main() {
  await client.connect();
  console.log("Connected successfully to DB.");
  
  const id = '300039';
  const schoolYr = 'SY 26-27';
  
  const query = `
      SELECT ps.school_id, ps.school_name, ps.iern,
             -- Unit1: only count as completed if the unit1 table row exists
             COALESCE(u1.unit1_completed, FALSE) AS unit1_completed,
             CASE WHEN u1.unit1_completed = TRUE THEN 100 ELSE COALESCE(u1.unit1, 0) END AS unit1,
             COALESCE(u1.unit1_completed, FALSE) AS unit1_has_data,
             -- Unit2: only count as completed if the unit2 table row exists
             COALESCE(u2.unit2_completed = 100.00, FALSE) AS unit2_completed,
             CASE WHEN COALESCE(u2.unit2_completed = 100.00, FALSE) = TRUE THEN 100 ELSE 0 END AS unit2,
             (u2.iern IS NOT NULL) AS unit2_has_data,
             -- Unit3: only count as completed if the unit3 table row actually exists
             (u3.iern IS NOT NULL AND u3.unit3 = TRUE) AS unit3_completed,
             CASE WHEN u3.iern IS NOT NULL AND u3.unit3 = TRUE THEN 100 ELSE 0 END AS unit3,
             (u3.iern IS NOT NULL) AS unit3_has_data,
             -- Unit4: only count as completed if the unit4 table row actually exists
             (u4.iern IS NOT NULL AND u4.unit4 = TRUE) AS unit4_completed,
             CASE WHEN u4.iern IS NOT NULL AND u4.unit4 = TRUE THEN 100 ELSE 0 END AS unit4,
             (u4.iern IS NOT NULL) AS unit4_has_data,
             COALESCE(u5.unit5_completed, FALSE) AS unit5_completed,
             CASE WHEN COALESCE(u5.unit5_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit5,
             (u5.iern IS NOT NULL) AS unit5_has_data,
             -- Unit6: only count as completed if the unit6 table row actually exists
             COALESCE(u6.unit6_completed, FALSE) AS unit6_completed,
             CASE WHEN COALESCE(u6.unit6_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit6,
             (u6.school_id IS NOT NULL) AS unit6_has_data,
             -- Unit7: only count as completed if the unit7 table row actually exists
             COALESCE(u7.unit7_completed, FALSE) AS unit7_completed,
             CASE WHEN COALESCE(u7.unit7_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit7,
             (u7.school_id IS NOT NULL) AS unit7_has_data,
             -- Unit8: only count as completed if the unit8 table row actually exists
             COALESCE(u8.unit8_completed, FALSE) AS unit8_completed,
             CASE WHEN COALESCE(u8.unit8_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit8,
             (u8.school_id IS NOT NULL) AS unit8_has_data,
             -- Unit9: only count as completed if the unit9 table row actually exists
             COALESCE(u9.unit9_completed, FALSE) AS unit9_completed,
             CASE WHEN COALESCE(u9.unit9_completed, FALSE) = TRUE THEN 100 ELSE 0 END AS unit9,
             (u9.school_id IS NOT NULL) AS unit9_has_data
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
      WHERE ps.school_id = $1 OR ps.iern = $1
  `;
  
  const res = await client.query(query, [id, schoolYr]);
  console.log("Calculated GET /api/ph_schools/:id result for SY 26-27:");
  console.log(res.rows[0]);
  
  await client.end();
}
main().catch(console.error);
