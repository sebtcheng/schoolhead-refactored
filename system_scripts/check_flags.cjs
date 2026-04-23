const { Pool } = require('pg');
const p = new Pool({
  connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});
p.query(`SELECT school_id, unit_completion,
  unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit9,
  unit1_completed, unit2_completed, unit3_completed, unit4_completed,
  unit5_completed, unit6_completed, unit7_completed, unit9_completed
FROM ph_schools WHERE school_id = '151006'`)
.then(r => { console.log(JSON.stringify(r.rows[0], null, 2)); p.end(); })
.catch(e => { console.error(e.message); p.end(); });
