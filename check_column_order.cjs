const pg = require('pg');
const { Pool } = pg;

const dbUrl = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: false
});

async function checkOrder() {
  try {
    const resForm = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form' ORDER BY ordinal_position");
    const colsForm = resForm.rows.map(r => r.column_name);

    const resCreate = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_create' ORDER BY ordinal_position");
    const colsCreate = resCreate.rows.map(r => r.column_name);

    let mismatches = [];
    for (let i = 0; i < Math.max(colsForm.length, colsCreate.length); i++) {
        if (colsForm[i] !== colsCreate[i]) {
            mismatches.push({ pos: i + 1, form: colsForm[i], create: colsCreate[i] });
        }
    }

    if (mismatches.length === 0) {
        console.log("Success! Column order matches perfectly.");
    } else {
        console.log("Mismatches found in column order:");
        console.log(JSON.stringify(mismatches, null, 2));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkOrder();
