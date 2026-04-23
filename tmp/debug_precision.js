import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ 
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd', 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  try {
    const res = await pool.query("SELECT email, role, region, length(region) as reg_len, division, length(division) as div_len FROM users WHERE email = 'testnueve@deped.gov.ph'");
    console.log("USER 'testnueve' DATA:");
    res.rows.forEach(r => {
      console.log(`Email: [${r.email}], Role: [${r.role}], Region: [${r.region}] (${r.reg_len}), Division: [${r.division}] (${r.div_len})`);
    });

    const res2 = await pool.query("SELECT DISTINCT region, length(region) as reg_len, division, length(division) as div_len FROM engineer_form WHERE region ILIKE '%Region II%'");
    console.log("\nREGION II PROJECTS IN DB:");
    res2.rows.forEach(r => {
      console.log(`Reg: [${r.region}] (${r.reg_len}), Div: [${r.division}] (${r.div_len})`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
